import { injectStyles, showToast } from "../styles/inject";
import { applyTheme } from "../styles/theme";
import type { ThemeMode } from "../styles/theme";
import { ScreenViewSessionManager } from "../core/viewer-session-manager";
import type { ViewerConfig, ViewerStatus } from "../core/types";

export interface ViewerModalOptions {
  config?: ViewerConfig;
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
  onSessionStart?: (code: string) => void;
  onSessionEnd?: (reason: string) => void;
}

const EYE_ICON_LG = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.35"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const FULLSCREEN_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`;
const COPY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;

export class ScreenViewModal {
  private overlay: HTMLElement | null = null;
  private opts: ViewerModalOptions;
  private manager: ScreenViewSessionManager;

  private status: ViewerStatus = "idle";
  private code: string | null = null;
  private stream: MediaStream | null = null;
  private isViewing: boolean = false;

  constructor(opts: ViewerModalOptions = {}) {
    injectStyles();
    this.opts = opts;

    const config: ViewerConfig = {
      testMode: true,
      testModeDelay: 1500,
      ...opts.config,
      onSessionStart: (code) => {
        this.isViewing = true;
        this.status = "viewing";
        opts.onSessionStart?.(code);
        opts.config?.onSessionStart?.(code);
      },
      onSessionEnd: (reason) => {
        this.isViewing = false;
        this.status = "idle";
        this.stream = null;
        this.code = null;
        opts.onSessionEnd?.(reason);
        opts.config?.onSessionEnd?.(reason);
        if (reason === 'remote_disconnect') {
          showToast('Druhá strana ukončila spojení', 'warning');
        } else if (reason === 'error') {
          showToast('Spojení bylo neočekávaně přerušeno', 'error');
        }
        this._closeOverlay();
      },
    };

    this.manager = new ScreenViewSessionManager(config, opts.connection);
  }

  open(): void {
    if (this.overlay) return;
    if (this.isViewing) {
      this.renderViewingView();
    } else {
      this.renderIdleView();
    }
  }

  close(): void {
    this._closeOverlay();
  }

  private _closeOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.opts.onClose?.();
  }

  // ─── Idle view ────────────────────────────────────────────────────────────

  private renderIdleView(): void {
    const overlay = this.createOverlay();
    const modal = document.createElement("div");
    modal.className = "sssdk-modal";

    modal.innerHTML = `
      <div class="sssdk-header">
        <div class="sssdk-title">
          <div class="sssdk-title-dot"></div>
          <span>Zobrazit obrazovku</span>
        </div>
        <button class="sssdk-close" id="sssdk-close-btn">✕</button>
      </div>
      <div class="sssdk-preview" id="sssdk-preview">
        <div class="sssdk-preview-placeholder">
          ${EYE_ICON_LG}
          <span>Klikněte na tlačítko pro zahájení</span>
        </div>
      </div>
      <div class="sssdk-actions" style="margin-top:4px">
        <button class="sssdk-btn sssdk-btn-primary" id="sssdk-start-btn" style="flex:1">
          Vygenerovat kód
        </button>
      </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.overlay = overlay;

    document.getElementById("sssdk-close-btn")?.addEventListener("click", () => this.close());
    document.getElementById("sssdk-start-btn")?.addEventListener("click", () => this.doRegister());
  }

  // ─── Register + waiting view ──────────────────────────────────────────────

  private async doRegister(): Promise<void> {
    this.showRegistering();
    try {
      const code = await this.manager.register();
      this.code = code;
      this.renderWaitingView(code);
      this.status = "waiting";
      await this.doStartViewing(code);
    } catch (err: unknown) {
      const e = err as { message?: string };
      this.showStartError(e.message ?? "Registrace selhala");
    }
  }

  private showRegistering(): void {
    const btn = document.getElementById("sssdk-start-btn") as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<div class="sssdk-spinner"></div> Generuji kód…`;
    }
  }

  private showStartError(msg: string): void {
    const btn = document.getElementById("sssdk-start-btn") as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Zkusit znovu";
    }
    const preview = document.getElementById("sssdk-preview");
    if (preview) {
      preview.innerHTML = `<div class="sssdk-preview-placeholder">
        <span style="color:#ef4444;font-size:13px">${msg}</span>
      </div>`;
    }
  }

  // ─── Waiting view (code displayed, waiting for client) ────────────────────

  private renderWaitingView(code: string): void {
    const preview = document.getElementById("sssdk-preview");
    if (preview) {
      const digits = code.split("").map(d =>
        `<div class="sssdk-viewer-code-digit">${d}</div>`
      ).join("");
      preview.innerHTML = `
        <div class="sssdk-viewer-waiting">
          <div class="sssdk-section-label" style="margin-bottom:14px">Kód pro klienta</div>
          <div class="sssdk-viewer-code-display" id="sssdk-code-display">
            ${digits}
          </div>
          <button class="sssdk-viewer-copy-btn" id="sssdk-copy-btn">
            ${COPY_ICON} Kopírovat kód
          </button>
          <div class="sssdk-viewer-waiting-status">
            <div class="sssdk-waiting-dots">
              <span></span><span></span><span></span>
            </div>
            <span>Čekám na klienta…</span>
          </div>
        </div>`;
    }

    const actions = document.querySelector<HTMLElement>(".sssdk-actions");
    if (actions) {
      actions.innerHTML = `<button class="sssdk-btn sssdk-btn-secondary" id="sssdk-cancel-btn" style="flex:1">Zrušit</button>`;
      document.getElementById("sssdk-cancel-btn")?.addEventListener("click", () => {
        this.manager.endSession("user_stopped");
        this.status = "idle";
        this.code = null;
        this._closeOverlay();
      });
    }

    document.getElementById("sssdk-copy-btn")?.addEventListener("click", () => {
      navigator.clipboard.writeText(code).catch(() => {});
      const btn = document.getElementById("sssdk-copy-btn");
      if (btn) {
        btn.textContent = "✓ Zkopírováno";
        setTimeout(() => {
          if (btn) btn.innerHTML = `${COPY_ICON} Kopírovat kód`;
        }, 2000);
      }
    });
  }

  private async doStartViewing(code: string): Promise<void> {
    try {
      const stream = await this.manager.startViewing(code);
      this.stream = stream;
      this.renderViewingView();
    } catch (err: unknown) {
      if (!this.overlay) return; // user cancelled
      const e = err as { message?: string };
      this.status = "error";
      this.showWaitingError(e.message ?? "Nepodařilo se připojit");
    }
  }

  private showWaitingError(msg: string): void {
    const preview = document.getElementById("sssdk-preview");
    if (preview) {
      preview.innerHTML = `<div class="sssdk-preview-placeholder">
        <span style="color:#ef4444;font-size:13px">${msg}</span>
      </div>`;
    }
    const actions = document.querySelector<HTMLElement>(".sssdk-actions");
    if (actions) {
      actions.innerHTML = `
        <button class="sssdk-btn sssdk-btn-secondary" id="sssdk-cancel-btn" style="flex:1">Zavřít</button>
        <button class="sssdk-btn sssdk-btn-primary" id="sssdk-retry-btn" style="flex:1">Zkusit znovu</button>`;
      document.getElementById("sssdk-cancel-btn")?.addEventListener("click", () => this.close());
      document.getElementById("sssdk-retry-btn")?.addEventListener("click", () => {
        this.status = "idle";
        this.code = null;
        this._closeOverlay();
        this.renderIdleView();
        if (this.overlay) document.body.appendChild(this.overlay);
      });
    }
  }

  // ─── Viewing view ─────────────────────────────────────────────────────────

  private renderViewingView(): void {
    if (!this.overlay) {
      const overlay = this.createOverlay();
      this.overlay = overlay;
      document.body.appendChild(overlay);
    }

    // Rebuild modal content for viewing state
    let modal = this.overlay.querySelector<HTMLElement>(".sssdk-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "sssdk-modal";
      this.overlay.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="sssdk-header">
        <div class="sssdk-title">
          <div class="sssdk-title-dot sharing"></div>
          <span>Příchozí obraz</span>
        </div>
        <button class="sssdk-close" id="sssdk-close-btn">✕</button>
      </div>
      <div class="sssdk-preview" id="sssdk-preview">
        <div class="sssdk-preview-placeholder" id="sssdk-p2p-loading" style="position:absolute;inset:0;background:transparent">
          <div class="sssdk-spinner" style="width:28px;height:28px;border-width:3px"></div>
          <span style="font-size:13px">Navazuji P2P spojení…</span>
        </div>
      </div>
      <div class="sssdk-sharing-status">
        <div class="sssdk-sharing-info">
          <span class="sssdk-sharing-live">LIVE</span>
          <span class="sssdk-sharing-text">Zobrazuji obrazovku klienta</span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="sssdk-btn sssdk-btn-secondary" id="sssdk-fullscreen-btn"
            style="flex:0;padding:0 14px;height:36px;font-size:13px">
            ${FULLSCREEN_ICON} Fullscreen
          </button>
          <button class="sssdk-btn sssdk-btn-stop" id="sssdk-stop-btn">Ukončit</button>
        </div>
      </div>`;

    if (this.stream) {
      const preview = modal.querySelector<HTMLElement>("#sssdk-preview")!;
      const video = document.createElement("video");
      video.autoplay = true;
      video.playsInline = true;
      video.style.cssText = "width:100%;height:100%;object-fit:contain";
      video.srcObject = this.stream;
      video.addEventListener("playing", () => {
        document.getElementById("sssdk-p2p-loading")?.remove();
        preview.querySelector<HTMLElement>(".sssdk-preview-badge")?.remove();
        const badge = document.createElement("div");
        badge.className = "sssdk-preview-badge";
        badge.textContent = "LIVE";
        preview.appendChild(badge);
      }, { once: true });
      preview.insertBefore(video, preview.firstChild);
    }

    document.getElementById("sssdk-close-btn")?.addEventListener("click", () => this.close());
    document.getElementById("sssdk-stop-btn")?.addEventListener("click", () => this.handleStop());
    document.getElementById("sssdk-fullscreen-btn")?.addEventListener("click", () => {
      const video = document.querySelector<HTMLVideoElement>("#sssdk-preview video");
      video?.requestFullscreen?.().catch(() => {});
    });
  }

  // ─── Stop ─────────────────────────────────────────────────────────────────

  private handleStop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.isViewing = false;
    this.status = "idle";
    this.manager.endSession("user_stopped");
    this.opts.onSessionEnd?.("user_stopped");
    this._closeOverlay();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private createOverlay(): HTMLElement {
    const overlay = document.createElement("div");
    overlay.className = "sssdk-overlay";
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.close();
    });
    applyTheme(overlay, this.opts.themeMode ?? "auto");
    return overlay;
  }
}
