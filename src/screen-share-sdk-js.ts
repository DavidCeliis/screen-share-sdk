// Entry point pro IIFE bundle — použití přes <script> tag v čistém HTML.
// Exponuje globální objekt window.ScreenShareSDK
// React zde záměrně není — jen vanilla JS API.

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