import type { ScreenShareConfig, ScreenShareError } from "../core/types";

export interface SignalRAdapter {
  connect(): Promise<void>;
  joinSession(code: string): Promise<{ sessionId: string }>;
  sendOffer(sessionId: string, offer: RTCSessionDescriptionInit): Promise<void>;
  sendCandidate(
    sessionId: string,
    candidate: RTCIceCandidateInit,
  ): Promise<void>;
  onAnswer(callback: (answer: RTCSessionDescriptionInit) => void): void;
  onCandidate(callback: (candidate: RTCIceCandidateInit) => void): void;
  onDisconnect(callback: () => void): void;
  disconnect(): Promise<void>;
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

  async joinSession(code: string): Promise<{ sessionId: string }> {
    await sleep(this.delay);
    if (code === "000000") {
      throw makeError("INVALID_CODE", "Test: code 000000 always fails");
    }
    const sessionId = `test-session-${code}-${Date.now()}`;
    console.info(`[ScreenShareSDK] TestMode: joined session ${sessionId}`);
    return { sessionId };
  }

  async sendOffer(
    _sessionId: string,
    _offer: RTCSessionDescriptionInit,
  ): Promise<void> {
    await sleep(200);
  }

  async sendCandidate(
    _sessionId: string,
    _candidate: RTCIceCandidateInit,
  ): Promise<void> {}

  onAnswer(callback: (answer: RTCSessionDescriptionInit) => void): void {
    // Simulate an answer after a short delay
    setTimeout(() => {
      callback({ type: "answer", sdp: "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n" });
    }, 500);
  }

  onCandidate(_callback: (candidate: RTCIceCandidateInit) => void): void {}

  onDisconnect(callback: () => void): void {
    this.disconnectCallbacks.push(callback);
  }

  async disconnect(): Promise<void> {
    this.disconnectCallbacks.forEach((cb) => cb());
  }
}

// ─── REAL SIGNALR ADAPTER ───────────────────────────────────────────────

export class RealSignalRAdapter implements SignalRAdapter {
  private hubUrl: string;
  private connection: unknown = null;
  private HubConnectionBuilder: unknown = null;

  constructor(hubUrl: string, existingConnection?: unknown) {
    this.hubUrl = hubUrl;
    if (existingConnection) {
      this.connection = existingConnection;
    }
  }

  private async loadSignalR() {
    if (this.HubConnectionBuilder) return;
    // Dynamically import so it's only loaded when real mode is used
    const signalR = await import("@microsoft/signalr");
    this.HubConnectionBuilder = signalR.HubConnectionBuilder;
  }

  async connect(): Promise<void> {
    if (this.connection) return; // reuse existing
    await this.loadSignalR();
    const { HubConnectionBuilder, LogLevel } =
      await import("@microsoft/signalr");
    this.connection = new HubConnectionBuilder()
      .withUrl(this.hubUrl)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();
    await (this.connection as any).start();
  }

  async joinSession(code: string): Promise<{ sessionId: string }> {
    const result = await (this.connection as any).invoke("JoinSession", code);
    if (!result?.sessionId) {
      throw makeError("INVALID_CODE", "Server rejected the code");
    }
    return result;
  }

  async sendOffer(
    sessionId: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<void> {
    await (this.connection as any).invoke(
      "SendOffer",
      sessionId,
      JSON.stringify(offer),
    );
  }

  async sendCandidate(
    sessionId: string,
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    await (this.connection as any).invoke(
      "SendCandidate",
      sessionId,
      JSON.stringify(candidate),
    );
  }

  onAnswer(callback: (answer: RTCSessionDescriptionInit) => void): void {
    (this.connection as any).on("ReceiveAnswer", (answerJson: string) => {
      callback(JSON.parse(answerJson));
    });
  }

  onCandidate(callback: (candidate: RTCIceCandidateInit) => void): void {
    (this.connection as any).on("ReceiveCandidate", (candidateJson: string) => {
      callback(JSON.parse(candidateJson));
    });
  }

  onDisconnect(callback: () => void): void {
    (this.connection as any).onclose(callback);
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
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
