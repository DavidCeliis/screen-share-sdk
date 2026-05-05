import type { ScreenShareConfig, ScreenShareError } from "../core/types";

export interface SignalRAdapter {
  connect(): Promise<void>;
  joinSession(code: string, role: "agent" | "client"): Promise<void>;
  sendOffer(code: string, offer: RTCSessionDescriptionInit): Promise<void>;
  sendAnswer(code: string, answer: RTCSessionDescriptionInit): Promise<void>;
  sendCandidate(code: string, candidate: RTCIceCandidateInit): Promise<void>;
  onOffer(callback: (sdp: string) => void): void;
  onAnswer(callback: (answer: RTCSessionDescriptionInit) => void): void;
  onCandidate(callback: (candidate: RTCIceCandidateInit) => void): void;
  onDisconnect(callback: () => void): void;
  disconnect(code?: string): Promise<void>;
}

// ─── TEST MODE ADAPTER ──────────────────────────────────────────────────────

export class TestModeAdapter implements SignalRAdapter {
  private delay: number;
  private disconnectCallbacks: Array<() => void> = [];

  constructor(delay = 1500) {
    this.delay = delay;
  }

  async connect(): Promise<void> {
    await sleep(300);
    console.info("[ScreenShareSDK] TestMode: SignalR connection simulated");
  }

  async joinSession(code: string, role: "agent" | "client"): Promise<void> {
    await sleep(this.delay);
    if (code === "000000") {
      throw makeError("INVALID_CODE", "Test: code 000000 always fails");
    }
    console.info(`[ScreenShareSDK] TestMode: ${role} joined session ${code}`);
  }

  async sendOffer(
    _code: string,
    _offer: RTCSessionDescriptionInit,
  ): Promise<void> {
    await sleep(200);
  }

  async sendAnswer(
    _code: string,
    _answer: RTCSessionDescriptionInit,
  ): Promise<void> {
    await sleep(200);
  }

  async sendCandidate(
    _code: string,
    _candidate: RTCIceCandidateInit,
  ): Promise<void> {}

  onOffer(_callback: (sdp: string) => void): void {}

  onAnswer(callback: (answer: RTCSessionDescriptionInit) => void): void {
    setTimeout(() => {
      callback({ type: "answer", sdp: "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n" });
    }, 500);
  }

  onCandidate(_callback: (candidate: RTCIceCandidateInit) => void): void {}

  onDisconnect(callback: () => void): void {
    this.disconnectCallbacks.push(callback);
  }

  async disconnect(_code?: string): Promise<void> {
    this.disconnectCallbacks.forEach((cb) => cb());
  }
}

// ─── REAL SIGNALR ADAPTER ───────────────────────────────────────────────

export class RealSignalRAdapter implements SignalRAdapter {
  private hubUrl: string;
  private connection: unknown = null;
  private HubConnectionBuilder: unknown = null;
  private disconnectCallback?: () => void;

  constructor(hubUrl: string, existingConnection?: unknown) {
    this.hubUrl = hubUrl;
    if (existingConnection) {
      this.connection = existingConnection;
    }
  }

  private async loadSignalR() {
    if (this.HubConnectionBuilder) return;
    const signalR = await import("@microsoft/signalr");
    this.HubConnectionBuilder = signalR.HubConnectionBuilder;
  }

  async connect(): Promise<void> {
    if (this.connection) return;
    await this.loadSignalR();
    const { HubConnectionBuilder, LogLevel } =
      await import("@microsoft/signalr");

    this.connection = new HubConnectionBuilder()
      .withUrl(this.hubUrl)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    (this.connection as any).on("Paired", () => {});
    (this.connection as any).on("LoginOk", () => {});
    (this.connection as any).on("Error", (msg: string) => {
      console.warn("[ScreenShareSDK] Server:", msg);
    });
    (this.connection as any).on("SessionEnded", () => {
      if (this.disconnectCallback) {
        this.disconnectCallback();
      }
    });

    await (this.connection as any).start();
  }

  async joinSession(code: string, role: "agent" | "client"): Promise<void> {
    const method = role === "agent" ? "AgentLogin" : "ClientLogin";
    await (this.connection as any).invoke(method, code);
  }

  async sendOffer(
    code: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<void> {
    await (this.connection as any).send("SendOffer", code, offer.sdp);
  }

  async sendAnswer(
    code: string,
    answer: RTCSessionDescriptionInit,
  ): Promise<void> {
    await (this.connection as any).send("SendAnswer", code, answer.sdp);
  }

  async sendCandidate(
    code: string,
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    await (this.connection as any).send(
      "SendIceCandidate",
      code,
      JSON.stringify(candidate),
    );
  }

  onOffer(callback: (sdp: string) => void): void {
    (this.connection as any).on("ReceiveOffer", (sdp: string) => {
      callback(sdp);
    });
  }

  onAnswer(callback: (answer: RTCSessionDescriptionInit) => void): void {
    (this.connection as any).on("ReceiveAnswer", (sdp: string) => {
      callback({ type: "answer", sdp });
    });
  }

  onCandidate(callback: (candidate: RTCIceCandidateInit) => void): void {
    (this.connection as any).on(
      "ReceiveIceCandidate",
      (candidateJson: string) => {
        try {
          const parsed = JSON.parse(candidateJson);

          console.log("[WebRTC] Přijatý ICE kandidát:", parsed);

          if (!parsed || !parsed.candidate) {
            return;
          }

          if (!parsed.candidate.startsWith("candidate:")) {
            parsed.candidate = "candidate:" + parsed.candidate;
          }

          callback(parsed);
        } catch (err) {
          console.error("[WebRTC] Chyba při parsování ICE kandidáta:", err);
        }
      },
    );
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallback = callback;
    (this.connection as any).onclose(callback);
  }

  async disconnect(code?: string): Promise<void> {
    if (this.connection) {
      if (code) {
        await (this.connection as any)
          .invoke("EndCommunication", code)
          .catch(() => {});
      }
      await (this.connection as any).stop();
    }
  }
}

// ─── FACTORY ───────────────────────────────────────────────────────────────

export function createAdapter(
  config: ScreenShareConfig,
  existingConnection?: unknown,
): SignalRAdapter {
  if (config.testMode) {
    return new TestModeAdapter(config.testModeDelay);
  }
  if (!config.hubUrl) {
    throw makeError(
      "CONNECTION_FAILED",
      "hubUrl is required when testMode is false",
    );
  }
  return new RealSignalRAdapter(config.hubUrl, existingConnection);
}

// ─── UTILS ───────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeError(
  code: ScreenShareError["code"],
  message: string,
): ScreenShareError & Error {
  const err = new Error(message) as ScreenShareError & Error;
  err.code = code;
  err.message = message;
  return err;
}
