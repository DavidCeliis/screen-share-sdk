// Entry point for the IIFE bundle — used via <script> tag in plain HTML.
// Exposes a global window.ScreenShareSDK object.
// React is intentionally excluded — vanilla JS API only.

export { createScreenShareButton } from './components/button-vanilla';
export { ScreenShareModal } from './components/modal-vanilla';
export { ScreenShareSessionManager, detectCurrentTabSupport } from './core/session-manager';

export { createScreenViewButton } from './components/viewer-button-vanilla';
export { ScreenViewModal } from './components/viewer-modal-vanilla';
export { ScreenViewSessionManager } from './core/viewer-session-manager';

export type {
  ScreenShareConfig,
  ScreenShareError,
  ScreenShareSession,
  ScreenShareStatus,
  ViewerConfig,
  ViewerStatus,
  ViewerState,
} from './core/types';