// src/components/button-vanilla.ts

import { injectStyles } from '../styles/inject';
import { ScreenShareModal } from './modal-vanilla';
import type { ThemeMode } from '../styles/theme';
import type { ScreenShareConfig } from '../core/types';
import { t, subscribeToLocale } from '../i18n';

export interface VanillaButtonOptions {
  container: string | HTMLElement;
  label?: string;
  className?: string;
  config?: ScreenShareConfig;
  connection?: unknown;
  style?: Partial<CSSStyleDeclaration>;
  /**
   * Controls color theme of the modal UI.
   * - `"auto"` (default) — follows OS/browser `prefers-color-scheme`
   * - `"dark"` — always dark
   * - `"light"` — always light
   * - `"custom"` — controlled via `setThemeMode()`
   */
  themeMode?: ThemeMode;
}

const SCREEN_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
  <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
</svg>`;

export function createScreenShareButton(opts: VanillaButtonOptions): HTMLButtonElement {
  injectStyles();

  const container = typeof opts.container === 'string'
    ? document.querySelector<HTMLElement>(opts.container)
    : opts.container;

  if (!container) throw new Error(`[ScreenShareSDK] Container not found: ${opts.container}`);

  const btn = document.createElement('button');
  btn.className = ['sssdk-trigger-btn', opts.className].filter(Boolean).join(' ');
  btn.innerHTML = `${SCREEN_ICON} ${opts.label ?? t('share.buttonIdle')}`;

  if (opts.style) Object.assign(btn.style, opts.style);

  let isActive = false;

  const updateLabel = () => {
    btn.innerHTML = isActive
      ? `${SCREEN_ICON} ${t('share.buttonActive')}`
      : `${SCREEN_ICON} ${opts.label ?? t('share.buttonIdle')}`;
  };

  // Single modal instance — holds all state for the entire lifetime of the button
  const modal = new ScreenShareModal({
    config: opts.config,
    connection: opts.connection,
    themeMode: opts.themeMode,
    onSessionStart: () => {
      isActive = true;
      btn.classList.add('active');
      updateLabel();
    },
    onSessionEnd: () => {
      isActive = false;
      btn.classList.remove('active');
      updateLabel();
    },
    onClose: () => {
      // Button reflects sharing state even after the modal is closed
    },
  });

  subscribeToLocale(updateLabel);

  btn.addEventListener('click', () => modal.open());

  container.appendChild(btn);
  return btn;
}
