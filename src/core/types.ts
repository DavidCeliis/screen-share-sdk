export interface ScreenShareConfig {
  /** SignalR hub URL. Required unless using testMode. */
  hubUrl?: string;

  /**
   * ICE servery pro WebRTC. Výchozí: Google STUN (stun:stun.l.google.com:19302).
   * Přepište pro vlastní TURN/STUN servery bez potřeby rebuild SDK.
   */
  iceServers?: RTCIceServer[];

  /** If true, simulates a successful connection without real SignalR/WebRTC */
  testMode?: boolean;

  /** Delay in ms before simulated connection succeeds (testMode only) */
  testModeDelay?: number;

  /**
   * Přepíše automatickou detekci podpory aktuálního tabu.
   *
   * Výchozí chování = auto-detekce:
   *   Chrome/Edge  → 'preferCurrentTab'   (přeskočí picker, rovnou zachytí tab)
   *   Firefox 116+ → 'selfBrowserSurface' (tab se zobrazí v pickeru)
   *   Safari/jiné  → 'manual'             (standardní picker, uživatel vybírá sám)
   *   bez podpory  → alert + error
   *
   * Možné hodnoty pro ruční override:
   *   'preferCurrentTab'   — vynutí Chrome chování (selže v jiných browserech)
   *   'selfBrowserSurface' — vynutí zobrazení tabu v pickeru
   *   'manual'             — standardní picker bez úprav
   *   'none'               — alias pro 'manual', explicitní záměr
   */
  currentTab?: "preferCurrentTab" | "selfBrowserSurface" | "manual" | "none";

  /** 'client' = sdílí obrazovku, 'agent' = sleduje (default: 'client') */
  role?: "agent" | "client";

  /** Called when screen share session starts */
  onSessionStart?: (sessionId: string) => void;

  /** Called when screen share session ends */
  onSessionEnd?: (
    reason: "user_stopped" | "remote_disconnect" | "error",
  ) => void;

  /** Called on any error */
  onError?: (error: ScreenShareError) => void;
}

export interface ScreenShareError {
  code:
    | "PERMISSION_DENIED"
    | "INVALID_CODE"
    | "CONNECTION_FAILED"
    | "STREAM_ERROR"
    | "UNSUPPORTED";
  message: string;
  originalError?: unknown;
}

export interface ScreenShareSession {
  sessionId: string;
  stream: MediaStream | null;
  isActive: boolean;
  stop: () => void;
}

export interface ViewerConfig {
  /** SignalR hub URL. Required unless using testMode. */
  hubUrl?: string;
  /** Base URL for REST API (e.g. https://example.com). Required unless using testMode. */
  apiUrl?: string;

  /**
   * ICE servery pro WebRTC. Výchozí: Google STUN (stun:stun.l.google.com:19302).
   * Přepište pro vlastní TURN/STUN servery bez potřeby rebuild SDK.
   */
  iceServers?: RTCIceServer[];
  testMode?: boolean;
  testModeDelay?: number;
  onSessionStart?: (code: string) => void;
  onSessionEnd?: (reason: "user_stopped" | "remote_disconnect" | "error") => void;
  onError?: (error: ScreenShareError) => void;
}

export type ViewerStatus =
  | "idle"
  | "registering"
  | "waiting"
  | "connecting"
  | "viewing"
  | "error";

export interface ViewerState {
  status: ViewerStatus;
  code: string | null;
  stream: MediaStream | null;
  error: ScreenShareError | null;
}

export type ScreenShareStatus =
  | "idle"
  | "requesting_screen"
  | "preview"
  | "connecting"
  | "sharing"
  | "error";

export interface ScreenShareState {
  status: ScreenShareStatus;
  stream: MediaStream | null;
  error: ScreenShareError | null;
  session: ScreenShareSession | null;
}

export interface ButtonProps {
  label?: string;
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
  config?: ScreenShareConfig;
  connection?: unknown;
}
