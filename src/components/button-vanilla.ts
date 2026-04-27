// src/components/button-vanilla.ts

import { injectStyles } from '../styles/inject';
import { ScreenShareModal } from './modal-vanilla';
import type { ScreenShareConfig } from '../core/types';

export interface VanillaButtonOptions {
  container: string | HTMLElement;
  label?: string;
  className?: string;
  config?: ScreenShareConfig;
  connection?: unknown;
  style?: Partial<CSSStyleDeclaration>;
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
  btn.innerHTML = `${SCREEN_ICON} ${opts.label ?? 'Share screen'}`;

  if (opts.style) Object.assign(btn.style, opts.style);

  // Jedna instance modalu — drží veškerý stav po celou dobu životnosti tlačítka
  const modal = new ScreenShareModal({
    config: opts.config,
    connection: opts.connection,
    onSessionStart: () => {
      btn.classList.add('active');
      btn.innerHTML = `${SCREEN_ICON} Sharing…`;
    },
    onSessionEnd: () => {
      btn.classList.remove('active');
      btn.innerHTML = `${SCREEN_ICON} ${opts.label ?? 'Share screen'}`;
    },
    onClose: () => {
      // Tlačítko reflektuje sharing stav i po zavření modalu
    },
  });

  btn.addEventListener('click', () => modal.open());

  container.appendChild(btn);
  return btn;
}