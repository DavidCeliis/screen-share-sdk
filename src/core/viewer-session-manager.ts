import { createAdapter, SignalRAdapter } from "../adapters/signalr-adapter";
import type { ViewerConfig, ScreenShareError } from "./types";

export class ScreenViewSessionManager {
  private config: ViewerConfig;
  private adapter: SignalRAdapter | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private currentCode: string | null = null;
  private existingConnection: unknown;

  constructor(config: ViewerConfig, existingConnection?: unknown) {
    this.config = config;
    this.existingConnection = existingConnection;
  }

  async register(): Promise<string> {
    if (this.config.testMode) {
      await sleep(this.config.testModeDelay ?? 1000);
      return Math.floor(100000 + Math.random() * 900000).toString();
    }
    if (!this.config.apiUrl) {
      throw this.makeError(
        "CONNECTION_FAILED",
        "apiUrl is required when testMode is false",
      );
    }
    const res = await fetch(`${this.config.apiUrl}/api/manage/Register`, {
      method: "POST",
    });
    if (!res.ok) {
      throw this.makeError(
        "CONNECTION_FAILED",
        `Registration failed: ${res.status}`,
      );
    }
    const data = await res.json();
    const code =
      typeof data === "string"
        ? data
        : (data.code ?? data.sessionCode ?? String(data));
    return code;
  }

  async startViewing(code: string): Promise<MediaStream> {
    this.currentCode = code;

    if (this.config.testMode) {
      await sleep(this.config.testModeDelay ?? 2000);
      const stream = createTestStream();
      this.config.onSessionStart?.(code);
      return stream;
    }

    const adapterCfg = { ...this.config, role: "agent" as const };
    this.adapter = createAdapter(adapterCfg as any, this.existingConnection);
    await this.adapter.connect();
    await this.adapter.joinSession(code, "agent");

    let disconnectFired = false;
    this.adapter.onDisconnect(() => {
      if (disconnectFired) return;
      disconnectFired = true;
      this.endSession("remote_disconnect");
    });

    return new Promise<MediaStream>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          this.makeError("CONNECTION_FAILED", "Timeout: klient se nepřipojil"),
        );
      }, 120_000);

      this.adapter!.onOffer(async (sdp) => {
        clearTimeout(timeout);
        try {
          const stream = await this.setupWebRTC(code, sdp);
          this.config.onSessionStart?.(code);
          resolve(stream);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  private async setupWebRTC(
    code: string,
    offerSdp: string,
  ): Promise<MediaStream> {
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers ?? [{ urls: "stun:stun.l.google.com:19302" }],
    });

    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection) return;
      const state = this.peerConnection.connectionState;

      if (state === "failed" || state === "disconnected") {
        this.endSession("error");
      } else if (state === "connected") {
        console.log("[WebRTC] P2P spojeni uspesne navazano");
      }
    };

    const pendingCandidates: RTCIceCandidateInit[] = [];
    let remoteDescSet = false;

    this.peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.adapter!.sendCandidate(code, candidate.toJSON());
      }
    };

    this.adapter!.onCandidate(async (candidateInit) => {
      if (remoteDescSet) {
        try {
          await this.peerConnection?.addIceCandidate(
            new RTCIceCandidate(candidateInit),
          );
        } catch (err) {
          console.warn("[WebRTC] addIceCandidate failed:", err);
        }
      } else {
        pendingCandidates.push(candidateInit);
      }
    });

    // Register ontrack before async operations to avoid missing early track events
    const streamPromise = new Promise<MediaStream>((resolve) => {
      this.peerConnection!.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        resolve(stream);
      };
    });

    await this.peerConnection.setRemoteDescription({
      type: "offer",
      sdp: offerSdp,
    });
    remoteDescSet = true;

    for (const c of pendingCandidates) {
      try {
        await this.peerConnection?.addIceCandidate(new RTCIceCandidate(c));
      } catch (err) {
        console.warn("[WebRTC] addIceCandidate (buffered) failed:", err);
      }
    }

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    await this.adapter!.sendAnswer(code, answer);

    return streamPromise;
  }

  endSession(
    reason: "user_stopped" | "remote_disconnect" | "error" = "user_stopped",
  ): void {
    if (!this.currentCode) return;
    const code = this.currentCode;
    this.currentCode = null;
    this.peerConnection?.close();
    this.peerConnection = null;

    if (code) {
      this.adapter?.disconnect(code).catch(() => {});
      if (this.config.apiUrl && !this.config.testMode) {
        fetch(`${this.config.apiUrl}/api/manage/end/${code}`, {
          method: "POST",
        }).catch(() => {});
      }
    }
    this.adapter = null;
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTestStream(): MediaStream {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d")!;
  let t = 0;
  const draw = () => {
    t++;
    ctx.fillStyle = "#0f0f14";
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = "#3b82f6";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TEST MODE", 640, 340);
    ctx.fillStyle = "#555";
    ctx.font = "22px sans-serif";
    ctx.fillText("Simulovaný příchozí obraz", 640, 395);
    ctx.fillStyle = "#333";
    ctx.font = "16px monospace";
    ctx.fillText(`t=${t}`, 640, 440);
  };
  draw();
  setInterval(draw, 1000);
  return (canvas as any).captureStream(10) as MediaStream;
}
