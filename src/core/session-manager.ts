import { createAdapter, SignalRAdapter } from "../adapters/signalr-adapter";
import type {
  ScreenShareConfig,
  ScreenShareSession,
  ScreenShareError,
} from "./types";

// ─── Browser capability detection ───────────────────────────────────

export type CurrentTabSupport =
  | "preferCurrentTab"
  | "selfBrowserSurface"
  | "manual"
  | "unsupported";

/**
 * Detekuje jakou úroveň podpory pro zachycení aktuálního tabu browser nabízí.
 *
 * 'preferCurrentTab'   — Chrome 94+/Edge 94+: přeskočí picker, rovnou zachytí tab
 * 'selfBrowserSurface' — Chrome 107+ / Firefox 116+: tab se zobrazí v pickeru
 * 'manual'             — getDisplayMedia funguje, ale aktuální tab není v nabídce
 *                        (Safari, starší Firefox) — uživatel musí vybrat jiný povrch
 * 'unsupported'        — getDisplayMedia vůbec není dostupné (mobil, starý browser)
 *
 * Poznámka k Chrome: Chrome 94-106 podporuje preferCurrentTab ale NE selfBrowserSurface.
 * Chrome 107+ podporuje oboje — preferujeme preferCurrentTab protože je UX lepší.
 * Chrome nikdy nekončí jako 'manual' — vždy má alespoň selfBrowserSurface.
 */
export function detectCurrentTabSupport(): CurrentTabSupport {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getDisplayMedia
  ) {
    return "unsupported";
  }

  const ua = navigator.userAgent;

  // Chromium-based (Chrome, Edge, Opera, Brave...)
  // Poznámka: Edge má "Chrome/X" v UA, takže tato detekce pokrývá i Edge.
  const chromeMatch = ua.match(/Chrome\/(\d+)/);
  if (chromeMatch) {
    const version = parseInt(chromeMatch[1], 10);
    if (version >= 94) return "preferCurrentTab"; // nejlepší UX, přeskočí picker
    if (version >= 107) return "selfBrowserSurface"; // teoreticky nedosažitelné (107 > 94) ale pro jistotu
    return "selfBrowserSurface"; // starší Chromium s getDisplayMedia, zkusíme
  }

  // Firefox
  const ffMatch = ua.match(/Firefox\/(\d+)/);
  if (ffMatch) {
    const version = parseInt(ffMatch[1], 10);
    if (version >= 116) return "selfBrowserSurface";
    return "manual"; // starší Firefox — tab v pickeru nevidí
  }

  if (ua.includes("Safari")) return "manual";

  // Ostatní — getDisplayMedia je, ale neznáme podporu tab selectoru
  return "manual";
}

// ── Session manager ─────────────────────────────────────────────────────────

export class ScreenShareSessionManager {
  private config: ScreenShareConfig;
  private adapter: SignalRAdapter | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private currentSession: ScreenShareSession | null = null;
  private existingConnection: unknown;

  constructor(config: ScreenShareConfig, existingConnection?: unknown) {
    this.config = config;
    this.existingConnection = existingConnection;
  }

  /**
   * Vrátí efektivní mode který bude použit pro requestScreen().
   * Užitečné pro UI — podle toho se rozhodne jestli zobrazit "Select screen" tlačítko.
   */
  getEffectiveMode(): CurrentTabSupport {
    if (this.config.currentTab && this.config.currentTab !== "none") {
      return this.config.currentTab as CurrentTabSupport;
    }
    return detectCurrentTabSupport();
  }

  async requestScreen(): Promise<MediaStream> {
    const support = detectCurrentTabSupport();

    if (support === "unsupported") {
      alert(
        "Váš prohlížeč nepodporuje sdílení obrazovky.\n\n" +
          "Použijte prosím Chrome, Edge nebo Firefox v aktuální verzi na počítači.",
      );
      throw this.makeError(
        "UNSUPPORTED",
        "getDisplayMedia is not supported in this browser",
      );
    }

    const mode =
      this.config.currentTab && this.config.currentTab !== "none"
        ? (this.config.currentTab as CurrentTabSupport)
        : support;

    const videoConstraints: MediaTrackConstraints & Record<string, unknown> = {
      frameRate: 30,
      displaySurface: "browser",
    };

    const extraOptions: Record<string, unknown> = {};

    if (mode === "preferCurrentTab") {
      extraOptions["preferCurrentTab"] = true;
    } else if (mode === "selfBrowserSurface") {
      extraOptions["selfBrowserSurface"] = "include";
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: videoConstraints,
        audio: false,
        ...extraOptions,
      });
      return stream;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        throw this.makeError(
          "PERMISSION_DENIED",
          "Screen share permission was denied",
        );
      }
      throw this.makeError("STREAM_ERROR", "Failed to get display media");
    }
  }

  async startSession(
    stream: MediaStream,
    code: string,
  ): Promise<ScreenShareSession> {
    this.adapter = createAdapter(this.config, this.existingConnection);
    await this.adapter.connect();

    let sessionId: string;
    try {
      const result = await this.adapter.joinSession(code);
      sessionId = result.sessionId;
    } catch (err: unknown) {
      const sdkErr = err as ScreenShareError;
      throw this.makeError(
        sdkErr.code ?? "CONNECTION_FAILED",
        sdkErr.message ?? "Failed to join session",
      );
    }

    if (!this.config.testMode) {
      await this.setupWebRTC(stream, sessionId);
    }

    const videoTrack = stream.getVideoTracks()[0];
    videoTrack?.addEventListener("ended", () => {
      this.endSession("user_stopped");
    });

    const session: ScreenShareSession = {
      sessionId,
      stream,
      isActive: true,
      stop: () => this.endSession("user_stopped"),
    };

    this.currentSession = session;
    this.config.onSessionStart?.(sessionId);

    this.adapter.onDisconnect(() => {
      this.endSession("remote_disconnect");
    });

    return session;
  }

  private async setupWebRTC(
    stream: MediaStream,
    sessionId: string,
  ): Promise<void> {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    stream.getTracks().forEach((track) => {
      this.peerConnection!.addTrack(track, stream);
    });

    this.peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.adapter!.sendCandidate(sessionId, candidate.toJSON());
      }
    };

    this.adapter!.onCandidate(async (candidateInit) => {
      await this.peerConnection?.addIceCandidate(
        new RTCIceCandidate(candidateInit),
      );
    });

    this.adapter!.onAnswer(async (answer) => {
      await this.peerConnection?.setRemoteDescription(
        new RTCSessionDescription(answer),
      );
    });

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    await this.adapter!.sendOffer(sessionId, offer);
  }

  /**
   * Vymění video track bez přerušení SignalR/WebRTC.
   * RTCRtpSender.replaceTrack() pošle nový video na druhý konec okamžitě,
   * bez renegotiace — agent nepozná přechod.
   * V testMode je no-op (žádné WebRTC).
   */
  async replaceVideoTrack(newTrack: MediaStreamTrack): Promise<void> {
    if (this.config.testMode) return;
    if (!this.peerConnection) {
      throw this.makeError("STREAM_ERROR", "No active peer connection");
    }
    const sender = this.peerConnection
      .getSenders()
      .find((s) => s.track?.kind === "video");
    if (!sender) {
      throw this.makeError("STREAM_ERROR", "No video sender found");
    }
    await sender.replaceTrack(newTrack);
  }

  private endSession(
    reason: "user_stopped" | "remote_disconnect" | "error",
  ): void {
    if (!this.currentSession?.isActive) return;

    this.currentSession.stream?.getTracks().forEach((t) => t.stop());
    this.peerConnection?.close();
    this.peerConnection = null;
    this.adapter?.disconnect().catch(() => {});
    this.adapter = null;

    if (this.currentSession) {
      (this.currentSession as any).isActive = false;
    }
    this.currentSession = null;

    this.config.onSessionEnd?.(reason);
  }

  private makeError(
    code: ScreenShareError["code"],
    message: string,
  ): Error & ScreenShareError {
    const err = new Error(message) as Error & ScreenShareError;
    err.code = code;
    return err;
  }
}
