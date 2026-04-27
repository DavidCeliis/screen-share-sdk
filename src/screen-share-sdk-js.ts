// Entry point pro IIFE bundle — použití přes <script> tag v čistém HTML.
// Exponuje globální objekt window.ScreenShareSDK
// React zde záměrně není — jen vanilla JS API.

export { createScreenShareButton } from './components/button-vanilla';
export { ScreenShareModal } from './components/modal-vanilla';
export { ScreenShareSessionManager, detectCurrentTabSupport } from './core/session-manager';
export type {
  ScreenShareConfig,
  ScreenShareError,
  ScreenShareSession,
  ScreenShareStatus,
} from './core/types';