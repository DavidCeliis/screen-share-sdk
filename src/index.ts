// Public API of screen-share-sdk

// ─── React ─────────────────────────────────────────────────────────
// Import only in React environments. Tree-shaking will exclude these
// automatically if React is not present in the consuming project.
export { ScreenShareButton } from "./components/ScreenShareButton";
export type { ScreenShareButtonProps } from "./components/ScreenShareButton";
export { useScreenShare } from "./components/use-screen-share";

// ─── Vanilla JS ─────────────────────────────────────────────
export { createScreenShareButton } from "./components/button-vanilla";
export type { VanillaButtonOptions } from "./components/button-vanilla";
export { ScreenShareModal } from "./components/modal-vanilla";
export type { VanillaModalOptions } from "./components/modal-vanilla";

// ─── Core / advanced usage ─────────────────────────────────────────────
export { ScreenShareSessionManager } from "./core/session-manager";
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
} from "./core/types";
