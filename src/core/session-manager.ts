import { createAdapter, SignalRAdapter } from "../adapters/signalr-adapter";
import type {
  ScreenShareConfig,
  ScreenShareSession,
  ScreenShareError,
  VideoQuality,
  VideoQualityCustom,
} from "./types";

const QUALITY_PRESETS: Record<string, VideoQualityCustom> = {
  low:    { width: 854,  height: 480,  frameRate: 10 },
  medium: { width: 1280, height: 720,  frameRate: 15 },
  high:   { width: 1920, height: 1080, frameRate: 30 },
};

function resolveQuality(q: VideoQuality | undefined): VideoQualityCustom | null {
  if (!q || q === "source") return null;
  if (typeof q === "string") return QUALITY_PRESETS[q];
  return q;
}

// ─── Browser capability detection ───────────────────────────────────

export type CurrentTabSupport =
  | "preferCurrentTab"
  | "selfBrowserSurface"
  | "manual"
  | "unsupported";

/**
 * Detects the level of current-tab capture support available in the browser.
 *
 * 'preferCurrentTab'   — Chrome 94+/Edge 94+: skips picker, captures tab immediately
 * 'selfBrowserSurface' — Chrome 107+ / Firefox 116+: tab appears in picker
 * 'manual'             — getDisplayMedia works but current tab is not listed
 *                        (Safari, older Firefox) — user must pick another surface
 * 'unsupported'        — getDisplayMedia is not available (mobile, old browser)
 *
 * Chrome note: Chrome 94-106 supports preferCurrentTab but NOT selfBrowserSurface.
 * Chrome 107+ supports both — we prefer preferCurrentTab for better UX.
 * Chrome never returns 'manual' — it always has at least selfBrowserSurface.
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
  // Note: Edge includes "Chrome/X" in its UA, so this detection covers Edge as well.
  const chromeMatch = ua.match(/Chrome\/(\d+)/);
  if (chromeMatch) {
    const version = parseInt(chromeMatch[1], 10);
    if (version >= 94) return "preferCurrentTab"; // best UX, skips picker
    if (version >= 107) return "selfBrowserSurface"; // theoretically unreachable (107 > 94) but kept for safety
    return "selfBrowserSurface"; // older Chromium with getDisplayMedia, try it
  }

  // Firefox
  const ffMatch = ua.match(/Firefox\/(\d+)/);
  if (ffMatch) {
    const version = parseInt(ffMatch[1], 10);
    if (version >= 116) return "selfBrowserSurface";
    return "manual"; // older Firefox — tab not visible in picker
  }

  if (ua.includes("Safari")) return "manual";

  // Other — getDisplayMedia exists but tab selector support is unknown
  return "manual";
}

// ── Session manager ─────────────────────────────────────────────────────────

export class ScreenShareSessionManager {
  private config: ScreenShareConfig;
  private adapter: SignalRAdapter | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private currentSession: ScreenShareSession | null = null;
  private existingConnection: unknown;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(config: ScreenShareConfig, existingConnection?: unknown) {
    this.config = config;
    this.existingConnection = existingConnection;
  }

  getEffectiveMode(): CurrentTabSupport {
    // Non-browser surface → always standard picker, never auto-capture current tab
    if (this.config.displaySurface && this.config.displaySurface !== "browser") {
      return "manual";
    }
    if (this.config.currentTab && this.config.currentTab !== "none") {
      return this.config.currentTab as CurrentTabSupport;
    }
    return detectCurrentTabSupport();
  }

  async requestScreen(): Promise<MediaStream> {
    const support = detectCurrentTabSupport();

    if (support === "unsupported") {
      alert(
        "Your browser does not support screen sharing.\n\n" +
          "Please use Chrome, Edge, or Firefox (current version) on a desktop device.",
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

    const preferredSurface = this.config.displaySurface ?? "browser";

    const quality = resolveQuality(this.config.videoQuality ?? "medium");

    const videoConstraints: MediaTrackConstraints & Record<string, unknown> = {
      ...(quality?.frameRate !== undefined && { frameRate: { ideal: quality.frameRate, max: quality.frameRate } }),
      ...(quality?.width     !== undefined && { width:     { ideal: quality.width,     max: quality.width     } }),
      ...(quality?.height    !== undefined && { height:    { ideal: quality.height,    max: quality.height    } }),
      ...(preferredSurface !== "any" && { displaySurface: preferredSurface }),
    };

    const extraOptions: Record<string, unknown> = {};

    // currentTab optimizations only make sense for browser-tab capture
    if (preferredSurface === "browser") {
      if (mode === "preferCurrentTab") {
        extraOptions["preferCurrentTab"] = true;
      } else if (mode === "selfBrowserSurface") {
        extraOptions["selfBrowserSurface"] = "include";
      }
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

    const role = this.config.role ?? "client";
    try {
      await this.adapter.joinSession(code, role);
    } catch (err: unknown) {
      const sdkErr = err as ScreenShareError;
      throw this.makeError(
        sdkErr.code ?? "CONNECTION_FAILED",
        sdkErr.message ?? "Failed to join session",
      );
    }

    this.pendingCandidates = [];

    if (!this.config.testMode) {
      await this.setupWebRTC(stream, code);
    }

    const videoTrack = stream.getVideoTracks()[0];
    videoTrack?.addEventListener(
      "ended",
      () => {
        this.endSession("user_stopped");
      },
      { once: true },
    );

    const session: ScreenShareSession = {
      sessionId: code,
      stream,
      isActive: true,
      stop: () => this.endSession("user_stopped"),
    };

    this.currentSession = session;

    if (this.config.testMode) {
      this.config.onSessionStart?.(code);
    }
    // In non-testMode, onSessionStart is called from setupWebRTC when state === "connected"

    let disconnectFired = false;
    this.adapter.onDisconnect(() => {
      if (disconnectFired) return;
      disconnectFired = true;
      this.endSession("remote_disconnect");
    });

    return session;
  }

  private async setupWebRTC(
    stream: MediaStream,
    sessionId: string,
  ): Promise<void> {
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers ?? [{ urls: "stun:stun.l.google.com:19302" }],
    });

    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection) return;
      const state = this.peerConnection.connectionState;

      if (state === "failed" || state === "disconnected") {
        this.endSession("error");
      } else if (state === "connected") {
        this.config.onSessionStart?.(sessionId);
      }
    };

    stream.getTracks().forEach((track) => {
      this.peerConnection!.addTrack(track, stream);
    });

    this.peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.adapter!.sendCandidate(sessionId, candidate.toJSON());
      }
    };

    this.adapter!.onCandidate(async (candidateInit) => {
      if (
        this.peerConnection?.remoteDescription &&
        this.peerConnection.remoteDescription.type
      ) {
        await this.peerConnection.addIceCandidate(
          new RTCIceCandidate(candidateInit),
        );
      } else {
        this.pendingCandidates.push(candidateInit);
      }
    });

    this.adapter!.onAnswer(async (answer) => {
      await this.peerConnection?.setRemoteDescription(
        new RTCSessionDescription(answer),
      );

      for (const candidateInit of this.pendingCandidates) {
        await this.peerConnection?.addIceCandidate(
          new RTCIceCandidate(candidateInit),
        );
      }
      this.pendingCandidates = [];
    });

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    await this.adapter!.sendOffer(sessionId, offer);
  }

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

    const sessionCode = this.currentSession.sessionId;
    this.currentSession.stream?.getTracks().forEach((t) => t.stop());
    this.peerConnection?.close();
    this.peerConnection = null;
    this.pendingCandidates = [];
    this.adapter?.disconnect(sessionCode).catch(() => {});
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