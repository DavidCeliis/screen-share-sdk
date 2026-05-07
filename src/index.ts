// Public API of screen-share-sdk

// ─── Theme ─────────────────────────────────────────────────────────
export { setThemeMode } from "./styles/theme";
export type { ThemeMode, ResolvedTheme } from "./styles/theme";
export { useThemeMode } from "./components/use-theme-mode";

// ─── React ─────────────────────────────────────────────────────────
export { ScreenShareButton } from "./components/ScreenShareButton";
export type { ScreenShareButtonProps } from "./components/ScreenShareButton";
export { useScreenShare } from "./components/use-screen-share";
export { useScreenView } from "./components/use-screen-view";

// ─── Vanilla JS ─────────────────────────────────────────────
export { createScreenShareButton } from "./components/button-vanilla";
export type { VanillaButtonOptions } from "./components/button-vanilla";
export { ScreenShareModal } from "./components/modal-vanilla";
export type { VanillaModalOptions } from "./components/modal-vanilla";

export { createScreenViewButton } from "./components/viewer-button-vanilla";
export type { ViewerButtonOptions } from "./components/viewer-button-vanilla";
export { ScreenViewModal } from "./components/viewer-modal-vanilla";
export type { ViewerModalOptions } from "./components/viewer-modal-vanilla";

// ─── Core / advanced usage ─────────────────────────────────────────────
export { ScreenShareSessionManager } from "./core/session-manager";
export { ScreenViewSessionManager } from "./core/viewer-session-manager";
export {
  TestModeAdapter,
  RealSignalRAdapter,
  createAdapter,
} from "./adapters/signalr-adapter";

// ─── Types ─────────────────────────────────────────────
export type {
  ScreenShareConfig,
  ScreenShareError,
  ScreenShareSession,
  ScreenShareState,
  ScreenShareStatus,
  ViewerConfig,
  ViewerStatus,
  ViewerState,
} from "./core/types";
