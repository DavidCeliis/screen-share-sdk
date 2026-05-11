export interface VideoQualityCustom {
  width?: number;
  height?: number;
  frameRate?: number;
}

/**
 * Built-in quality presets:
 * - `"low"`    — 854×480 @ 10 fps
 * - `"medium"` — 1280×720 @ 15 fps (default)
 * - `"high"`   — 1920×1080 @ 30 fps
 * - `"source"` — no constraints, browser sends at native resolution
 *
 * Or a custom object: `{ width: 1920, height: 1080, frameRate: 24 }`
 * (all properties are optional)
 */
export type VideoQuality = "low" | "medium" | "high" | "source" | VideoQualityCustom;

export interface ScreenShareConfig {
  /** SignalR hub URL. Required unless using testMode. */
  hubUrl?: string;

  /**
   * ICE servers for WebRTC. Default: Google STUN (stun:stun.l.google.com:19302).
   * Override with your own STUN/TURN servers — no SDK rebuild required.
   */
  iceServers?: RTCIceServer[];

  /**
   * Quality of the outgoing video. Default: `"medium"` (1280×720 @ 15 fps).
   * Use a preset string or a custom `{ width, height, frameRate }` object.
   */
  videoQuality?: VideoQuality;

  /** If true, simulates a successful connection without real SignalR/WebRTC */
  testMode?: boolean;

  /** Delay in ms before simulated connection succeeds (testMode only) */
  testModeDelay?: number;

  /**
   * What type of surface the user can share.
   *
   * - `"browser"` (default) — browser tabs only; Chrome automatically skips
   *   the picker and captures the current tab (see currentTab)
   * - `"window"`  — application windows; standard picker, currentTab logic is ignored
   * - `"monitor"` — full screen; standard picker, currentTab logic is ignored
   * - `"any"`     — no restriction, user picks from the full list (tab / window / monitor)
   *
   * Passed as a hint to getDisplayMedia — the browser may not always honour it,
   * but typically pre-selects the matching surface type or hides others.
   */
  displaySurface?: "browser" | "window" | "monitor" | "any";

  /**
   * Overrides automatic current-tab capture mode detection.
   * Only applies when displaySurface === "browser" (or not set).
   *
   * Default behaviour = auto-detection:
   *   Chrome/Edge  → 'preferCurrentTab'   (skips picker, captures tab immediately)
   *   Firefox 116+ → 'selfBrowserSurface' (tab appears in the picker)
   *   Safari/other → 'manual'             (standard picker, user picks manually)
   *   unsupported  → alert + error
   *
   * Manual override values:
   *   'preferCurrentTab'   — force Chrome behaviour (fails in other browsers)
   *   'selfBrowserSurface' — force tab to appear in picker
   *   'manual'             — standard picker, no modifications
   *   'none'               — alias for 'manual'
   */
  currentTab?: "preferCurrentTab" | "selfBrowserSurface" | "manual" | "none";

  /** 'client' = shares screen, 'agent' = views (default: 'client') */
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
   * ICE servers for WebRTC. Default: Google STUN (stun:stun.l.google.com:19302).
   * Override with your own STUN/TURN servers — no SDK rebuild required.
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
