// src/components/modal-vanilla.ts

import { injectStyles, showToast } from '../styles/inject';
import { applyTheme } from '../styles/theme';
import type { ThemeMode } from '../styles/theme';
import { ScreenShareSessionManager } from '../core/session-manager';
import type { ScreenShareConfig, ScreenShareStatus } from '../core/types';

export interface VanillaModalOptions {
  config?: ScreenShareConfig;
  connection?: unknown;
  /**
   * Controls color theme of the modal UI.
   * - `"auto"` (default) — follows OS/browser `prefers-color-scheme`
   * - `"dark"` — always dark
   * - `"light"` — always light
   * - `"custom"` — controlled via `setThemeMode()`
   */
  themeMode?: ThemeMode;
  onClose?: () => void;
  onSessionStart?: (sessionId: string) => void;
  onSessionEnd?: (reason: string) => void;
}

const SCREEN_ICON_SM = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`;
const MONITOR_ICON_LG = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.35"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`;
const REFRESH_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
const ERROR_ICON = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.7"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>`;

export class ScreenShareModal {
  private overlay: HTMLElement | null = null;
  private opts: VanillaModalOptions;
  private manager: ScreenShareSessionManager;

  // Persistent state
  private stream: MediaStream | null = null;
  private status: ScreenShareStatus = 'idle';
  private lastCode: string = '';
  private permissionDenied: boolean = false;
  private isSharing: boolean = false;

  constructor(opts: VanillaModalOptions = {}) {
    injectStyles();
    this.opts = opts;

    const config: ScreenShareConfig = {
      testMode: true,
      testModeDelay: 1500,
      ...opts.config,
      onSessionStart: (id) => {
        this.isSharing = true;
        this.status = 'sharing';
        opts.onSessionStart?.(id);
        opts.config?.onSessionStart?.(id);
        setTimeout(() => this._closeOverlay(), 600);
      },
      onSessionEnd: (reason) => {
        // Only called by the session manager (e.g. remote_disconnect or track ended)
        // handleStop() does NOT call this — it handles its own reset
        this.isSharing = false;
        this.status = 'idle';
        this.stream = null;
        opts.onSessionEnd?.(reason);
        opts.config?.onSessionEnd?.(reason);
        if (reason === 'remote_disconnect') {
          showToast('The other side ended the connection', 'warning');
        } else if (reason === 'error') {
          showToast('Connection was unexpectedly interrupted', 'error');
        }
        this._closeOverlay();
      },
    };

    this.manager = new ScreenShareSessionManager(config, opts.connection);
  }

  open(): void {
    if (this.overlay) return;
    if (this.isSharing) {
      this.renderSharingView();
    } else {
      this.renderSetupView();
      if (this.manager.getEffectiveMode() === 'preferCurrentTab') {
        this.doRequestScreen();
      }
    }
  }

  // User-initiated close (X button, click outside) — stream is kept alive if sharing
  close(): void {
    this._closeOverlay();
    if (!this.isSharing) {
      this.stream?.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  // Internal overlay close with no side effects on the stream
  private _closeOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.opts.onClose?.();
  }

  // ─── Request screen ──────────────────────────────────────────────────────

  private async doRequestScreen(): Promise<MediaStream | null> {
    this.permissionDenied = false;
    try {
      const s = await this.manager.requestScreen();
      this.stream = s;
      this.status = 'preview';

      s.getVideoTracks()[0]?.addEventListener('ended', () => {
        this.stream = null;
        this.status = 'idle';
        if (this.isSharing) {
          this.isSharing = false;
          this._closeOverlay();
        } else {
          this.refreshPreview();
          this.updateConnectBtn();
        }
      });

      this.refreshPreview();
      this.updateConnectBtn(); // stream is now available — re-evaluate button state
      return s;
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === 'UNSUPPORTED') {
        this._closeOverlay();
      } else if (e.code === 'PERMISSION_DENIED') {
        this.permissionDenied = true;
        this.status = 'idle';
        this.refreshPreview();
      }
      return null;
    }
  }

  // ─── Setup view ──────────────────────────────────────────────────────────

  private renderSetupView(): void {
    const overlay = this.createOverlay();
    const modal = document.createElement('div');
    modal.className = 'sssdk-modal';

    const isPreferCurrentTab = this.manager.getEffectiveMode() === 'preferCurrentTab';

    modal.innerHTML = `
      <div class="sssdk-header">
        <div class="sssdk-title">
          <div class="sssdk-title-dot" id="sssdk-dot"></div>
          <span id="sssdk-title-text">Share screen</span>
        </div>
        <button class="sssdk-close" id="sssdk-close-btn">✕</button>
      </div>
      <div class="sssdk-preview" id="sssdk-preview">
        <div class="sssdk-preview-placeholder">
          ${MONITOR_ICON_LG}
          <span>${isPreferCurrentTab ? 'Waiting for sharing permission…' : 'Click "Select screen" to continue'}</span>
        </div>
      </div>
      <div class="sssdk-section-label">Agent code</div>
      <div class="sssdk-code-input-wrapper" id="sssdk-digits">
        ${Array.from({length: 6}, (_, i) =>
          `<input class="sssdk-code-digit${this.lastCode[i] ? ' filled' : ''}"
                  id="sssdk-d${i}" maxlength="1" inputmode="numeric" type="text"
                  value="${this.lastCode[i] ?? ''}" autocomplete="off">`
        ).join('')}
      </div>
      <div class="sssdk-error-msg" id="sssdk-error"></div>
      <div class="sssdk-actions" id="sssdk-actions">
        ${!isPreferCurrentTab
          ? `<button class="sssdk-btn sssdk-btn-secondary" id="sssdk-select-btn">${SCREEN_ICON_SM} Vybrat obrazovku</button>`
          : ''}
        <button class="sssdk-btn sssdk-btn-primary" id="sssdk-connect-btn" disabled
          ${isPreferCurrentTab ? 'style="flex:1"' : ''}>Connect</button>
      </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.overlay = overlay;

    this.bindSetupEvents();

    // Pre-filled code doesn't trigger input events —
    // check button state directly after render
    this.updateConnectBtn();
  }

  private bindSetupEvents(): void {
    document.getElementById('sssdk-close-btn')?.addEventListener('click', () => this.close());
    document.getElementById('sssdk-select-btn')?.addEventListener('click', () => this.doRequestScreen());
    document.getElementById('sssdk-connect-btn')?.addEventListener('click', () => this.doConnect());

    const digits = this.getDigits();
    digits.forEach((inp, idx) => {
      inp.addEventListener('input', () => {
        const v = inp.value.replace(/\D/g, '');
        inp.value = v.slice(0, 1);
        inp.classList.toggle('filled', !!inp.value);
        if (v && idx < 5) digits[idx + 1]?.focus();
        this.updateConnectBtn();
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !inp.value && idx > 0) {
          digits[idx - 1].value = '';
          digits[idx - 1].classList.remove('filled');
          digits[idx - 1].focus();
          this.updateConnectBtn();
        }
        if (e.key === 'Enter' && !(document.getElementById('sssdk-connect-btn') as HTMLButtonElement)?.disabled) {
          this.doConnect();
        }
      });
      inp.addEventListener('paste', (e) => {
        const text = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
        if (text.length >= 6) {
          e.preventDefault();
          text.slice(0, 6).split('').forEach((ch, i) => {
            if (digits[i]) { digits[i].value = ch; digits[i].classList.add('filled'); }
          });
          digits[5]?.focus();
          this.updateConnectBtn();
        }
      });
    });
  }

  // ─── Sharing view ────────────────────────────────────────────────────────

  private renderSharingView(): void {
    const overlay = this.createOverlay();
    const modal = document.createElement('div');
    modal.className = 'sssdk-modal';

    modal.innerHTML = `
      <div class="sssdk-header">
        <div class="sssdk-title">
          <div class="sssdk-title-dot sharing"></div>
          Sharing active
        </div>
        <button class="sssdk-close" id="sssdk-close-btn">✕</button>
      </div>
      <div class="sssdk-preview" id="sssdk-preview">
        <div class="sssdk-preview-badge">LIVE</div>
      </div>
      <div class="sssdk-sharing-status">
        <div class="sssdk-sharing-info">
          <span class="sssdk-sharing-live">LIVE</span>
          <span class="sssdk-sharing-text">Screen is being shared</span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="sssdk-btn sssdk-btn-secondary" id="sssdk-switch-btn"
            style="flex:0;padding:0 14px;height:36px;font-size:13px">
            ${SCREEN_ICON_SM} Switch
          </button>
          <button class="sssdk-btn sssdk-btn-stop" id="sssdk-stop-btn">Stop</button>
        </div>
      </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.overlay = overlay;

    if (this.stream) {
      const preview = modal.querySelector<HTMLElement>('#sssdk-preview')!;
      const video = document.createElement('video');
      video.autoplay = true; video.muted = true; video.playsInline = true;
      video.style.cssText = 'width:100%;height:100%;object-fit:contain';
      video.srcObject = this.stream;
      preview.insertBefore(video, preview.firstChild);
    }

    document.getElementById('sssdk-close-btn')?.addEventListener('click', () => this.close());
    document.getElementById('sssdk-stop-btn')?.addEventListener('click', () => this.handleStop());
    document.getElementById('sssdk-switch-btn')?.addEventListener('click', () => this.handleSwitchScreen());
  }

  // ─── Preview refresh ─────────────────────────────────────────────────────

  private refreshPreview(): void {
    const preview = document.getElementById('sssdk-preview');
    if (!preview) return;
    while (preview.firstChild) preview.removeChild(preview.firstChild);

    if (this.stream) {
      const video = document.createElement('video');
      video.autoplay = true; video.muted = true; video.playsInline = true;
      video.style.cssText = 'width:100%;height:100%;object-fit:contain';
      video.srcObject = this.stream;
      preview.appendChild(video);
      const badge = document.createElement('div');
      badge.className = 'sssdk-preview-badge';
      badge.textContent = 'PREVIEW';
      preview.appendChild(badge);

    } else if (this.permissionDenied) {
      preview.innerHTML = `
        <div class="sssdk-preview-placeholder">
          ${ERROR_ICON}
          <span style="color:#ef4444;font-size:13px">Screen sharing permission was denied</span>
          <span class="sssdk-permission-hint">
            Click below to try again or allow sharing in the site settings.
          </span>
        </div>`;
      const actions = document.getElementById('sssdk-actions');
      if (actions) {
        actions.innerHTML = `
          <button class="sssdk-btn sssdk-btn-secondary" id="sssdk-retry-btn">${REFRESH_ICON} Zkusit znovu</button>
          <button class="sssdk-btn sssdk-btn-primary" id="sssdk-connect-btn" disabled>Connect</button>`;
        document.getElementById('sssdk-retry-btn')?.addEventListener('click', () => this.doRequestScreen());
        document.getElementById('sssdk-connect-btn')?.addEventListener('click', () => this.doConnect());
      }
    } else {
      const mode = this.manager.getEffectiveMode();
      preview.innerHTML = `
        <div class="sssdk-preview-placeholder">
          ${MONITOR_ICON_LG}
          <span>${mode === 'preferCurrentTab' ? 'Waiting for sharing permission…' : 'Click "Select screen" to continue'}</span>
        </div>`;
    }
  }

  // ─── Connect ─────────────────────────────────────────────────────────────

  private async doConnect(): Promise<void> {
    if (!this.stream) return;
    const code = this.getCurrentCode();
    if (code.length < 6) return;
    this.showConnecting();
    this.showError('');
    try {
      await this.manager.startSession(this.stream, code);
      this.lastCode = code;
      this.showWaitingForP2P();
    } catch (err: unknown) {
      const e = err as { message?: string };
      this.showError(e.message ?? 'Failed to connect');
      this.resetConnectBtn();
    }
  }

  // ─── Stop / switch ────────────────────────────────────────────────────────

  private handleStop(): void {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.isSharing = false;
    this.status = 'idle';
    // Notify button-vanilla directly — do NOT go through session-manager to avoid double-call
    this.opts.onSessionEnd?.('user_stopped');
    this._closeOverlay();
  }

  private async handleSwitchScreen(): Promise<void> {
    try {
      const newStream = await this.manager.requestScreen();
      await this.manager.replaceVideoTrack(newStream.getVideoTracks()[0]);
      this.stream?.getTracks().forEach(t => t.stop());
      this.stream = newStream;
      const video = document.querySelector<HTMLVideoElement>('#sssdk-preview video');
      if (video) video.srcObject = newStream;
      newStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        this.stream = null;
        this.isSharing = false;
        this._closeOverlay();
      });
    } catch {
      // user cancelled the picker
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private createOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'sssdk-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.close(); });
    applyTheme(overlay, this.opts.themeMode ?? 'auto');
    return overlay;
  }

  private getDigits(): HTMLInputElement[] {
    return Array.from({length: 6}, (_, i) =>
      document.getElementById(`sssdk-d${i}`) as HTMLInputElement
    ).filter(Boolean);
  }

  private getCurrentCode(): string {
    return this.getDigits().map(d => d.value).join('');
  }

  // Reads directly from DOM inputs, not a cached value
  // Pre-filled code (value attr) is in the DOM immediately after render — works correctly
  private updateConnectBtn(): void {
    const btn = document.getElementById('sssdk-connect-btn') as HTMLButtonElement | null;
    if (!btn) return;
    const code = this.getCurrentCode();
    btn.disabled = !(this.stream && code.length === 6);
  }

  private showConnecting(): void {
    const btn = document.getElementById('sssdk-connect-btn') as HTMLButtonElement | null;
    if (!btn) return;
    btn.disabled = true;
    btn.classList.add('connecting');
    btn.innerHTML = `<div class="sssdk-spinner"></div> Connecting…`;
    const t = document.getElementById('sssdk-title-text');
    if (t) t.textContent = 'Connecting…';
  }

  private showWaitingForP2P(): void {
    const btn = document.getElementById('sssdk-connect-btn') as HTMLButtonElement | null;
    if (btn) {
      btn.innerHTML = `<div class="sssdk-spinner"></div> Establishing P2P connection…`;
    }
    const t = document.getElementById('sssdk-title-text');
    if (t) t.textContent = 'Establishing P2P connection…';
  }

  private resetConnectBtn(): void {
    const btn = document.getElementById('sssdk-connect-btn') as HTMLButtonElement | null;
    if (!btn) return;
    btn.classList.remove('connecting');
    btn.innerHTML = 'Connect';
    this.updateConnectBtn();
    const t = document.getElementById('sssdk-title-text');
    if (t) t.textContent = 'Share screen';
  }

  private showError(msg: string): void {
    const el = document.getElementById('sssdk-error');
    if (el) el.textContent = msg;
  }
}