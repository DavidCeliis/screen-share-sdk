import { injectStyles } from "../styles/inject";
import { ScreenShareSessionManager } from "../core/session-manager";
import type { ScreenShareConfig, ScreenShareStatus } from "../core/types";

const SCREEN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
</svg>`;

const MONITOR_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:40px;height:40px">
  <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
</svg>`;

export interface VanillaModalOptions {
  config?: ScreenShareConfig;
  connection?: unknown;
  onClose?: () => void;
  onSessionStart?: (sessionId: string) => void;
  onSessionEnd?: (reason: string) => void;
}

export class ScreenShareModal {
  private overlay: HTMLElement | null = null;
  private stream: MediaStream | null = null;
  private manager: ScreenShareSessionManager;
  private status: ScreenShareStatus = "idle";
  private opts: VanillaModalOptions;

  constructor(opts: VanillaModalOptions = {}) {
    injectStyles();
    this.opts = opts;
    const config: ScreenShareConfig = {
      testMode: true,
      testModeDelay: 1500,
      ...opts.config,
      onSessionStart: (id) => {
        this.setStatus("sharing");
        opts.onSessionStart?.(id);
        opts.config?.onSessionStart?.(id);
        this.close();
      },
      onSessionEnd: (reason) => {
        this.setStatus("idle");
        opts.onSessionEnd?.(reason);
        opts.config?.onSessionEnd?.(reason);
      },
    };
    this.manager = new ScreenShareSessionManager(config, opts.connection);
  }

  open(): void {
    if (this.overlay) return;
    this.renderIdle();
  }

  close(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.opts.onClose?.();
  }

  private setStatus(s: ScreenShareStatus) {
    this.status = s;
  }

  private renderIdle(): void {
    this.overlay?.remove();

    const overlay = document.createElement("div");
    overlay.className = "sssdk-overlay";
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.close();
    });

    const modal = document.createElement("div");
    modal.className = "sssdk-modal";

    // Header
    modal.innerHTML = `
      <div class="sssdk-header">
        <div class="sssdk-title">
          <div class="sssdk-title-dot"></div>
          Share your screen
        </div>
        <button class="sssdk-close" id="sssdk-close-btn">✕</button>
      </div>
      <div class="sssdk-preview" id="sssdk-preview">
        <div class="sssdk-preview-placeholder" id="sssdk-placeholder">
          ${MONITOR_ICON}
          <span>Click "Select screen" to preview</span>
        </div>
      </div>
      <div class="sssdk-section-label">Agent code</div>
      <div class="sssdk-code-input-wrapper" id="sssdk-code-wrapper">
        ${Array.from(
          { length: 6 },
          (_, i) =>
            `<input class="sssdk-code-digit" id="sssdk-digit-${i}" maxlength="1" inputmode="numeric" type="text" autocomplete="off">`,
        ).join("")}
      </div>
      <div class="sssdk-error-msg" id="sssdk-error"></div>
      <div class="sssdk-actions">
        <button class="sssdk-btn sssdk-btn-secondary" id="sssdk-select-btn">
          ${SCREEN_ICON} Select screen
        </button>
        <button class="sssdk-btn sssdk-btn-primary" id="sssdk-connect-btn" disabled>
          Connect
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.overlay = overlay;

    this.bindIdleEvents(modal);
  }

  private bindIdleEvents(modal: HTMLElement): void {
    modal
      .querySelector("#sssdk-close-btn")!
      .addEventListener("click", () => this.close());

    // Select screen button
    modal
      .querySelector("#sssdk-select-btn")!
      .addEventListener("click", async () => {
        try {
          const stream = await this.manager.requestScreen();
          this.stream = stream;
          this.showPreview(stream, modal);

          // When browser native stop is clicked
          stream.getVideoTracks()[0]?.addEventListener("ended", () => {
            this.stream = null;
            this.hidePreview(modal);
            this.updateConnectBtn(modal);
          });

          this.updateConnectBtn(modal);
        } catch (err: unknown) {
          const e = err as { code?: string; message?: string };
          if (e.code === "PERMISSION_DENIED") {
            this.showError(modal, "Screen share permission denied");
          }
        }
      });

    // 6-digit code OTP input
    const digits = Array.from(
      { length: 6 },
      (_, i) => modal.querySelector<HTMLInputElement>(`#sssdk-digit-${i}`)!,
    );

    digits.forEach((input, idx) => {
      input.addEventListener("input", () => {
        const val = input.value.replace(/\D/g, "");
        input.value = val.slice(0, 1);
        if (val && idx < 5) digits[idx + 1].focus();
        input.classList.toggle("filled", !!input.value);
        this.updateConnectBtn(modal);
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !input.value && idx > 0) {
          digits[idx - 1].focus();
          digits[idx - 1].value = "";
          digits[idx - 1].classList.remove("filled");
          this.updateConnectBtn(modal);
        }
        if (e.key === "Enter") {
          const connectBtn =
            modal.querySelector<HTMLButtonElement>("#sssdk-connect-btn")!;
          if (!connectBtn.disabled) connectBtn.click();
        }
      });

      input.addEventListener("paste", (e) => {
        const text = (e.clipboardData?.getData("text") ?? "").replace(
          /\D/g,
          "",
        );
        if (text.length >= 6) {
          e.preventDefault();
          text
            .slice(0, 6)
            .split("")
            .forEach((ch, i) => {
              digits[i].value = ch;
              digits[i].classList.add("filled");
            });
          digits[5].focus();
          this.updateConnectBtn(modal);
        }
      });
    });

    // Connect button
    modal
      .querySelector("#sssdk-connect-btn")!
      .addEventListener("click", async () => {
        if (!this.stream) return;

        const code = digits.map((d) => d.value).join("");
        if (code.length < 6) return;

        this.showConnecting(modal);
        this.showError(modal, "");

        try {
          await this.manager.startSession(this.stream, code);
          this.renderSharing(modal);
        } catch (err: unknown) {
          const e = err as { code?: string; message?: string };
          this.showError(modal, e.message ?? "Connection failed");
          digits.forEach((d) => d.classList.add("error"));
          setTimeout(
            () => digits.forEach((d) => d.classList.remove("error")),
            600,
          );
          this.resetConnectBtn(modal);
        }
      });
  }

  private getCode(modal: HTMLElement): string {
    return Array.from(
      { length: 6 },
      (_, i) =>
        modal.querySelector<HTMLInputElement>(`#sssdk-digit-${i}`)?.value ?? "",
    ).join("");
  }

  private showPreview(stream: MediaStream, modal: HTMLElement): void {
    const preview = modal.querySelector("#sssdk-preview")!;
    preview.querySelector("#sssdk-placeholder")?.remove();

    let video = preview.querySelector<HTMLVideoElement>("video");
    if (!video) {
      video = document.createElement("video");
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      preview.appendChild(video);
    }
    video.srcObject = stream;

    const badge = document.createElement("div");
    badge.className = "sssdk-preview-badge";
    badge.id = "sssdk-badge";
    badge.textContent = "PREVIEW";
    preview.appendChild(badge);
  }

  private hidePreview(modal: HTMLElement): void {
    const preview = modal.querySelector("#sssdk-preview")!;
    preview.querySelector("video")?.remove();
    preview.querySelector("#sssdk-badge")?.remove();
    if (!preview.querySelector("#sssdk-placeholder")) {
      const ph = document.createElement("div");
      ph.className = "sssdk-preview-placeholder";
      ph.id = "sssdk-placeholder";
      ph.innerHTML = `${MONITOR_ICON}<span>Click "Select screen" to preview</span>`;
      preview.appendChild(ph);
    }
  }

  private updateConnectBtn(modal: HTMLElement): void {
    const btn = modal.querySelector<HTMLButtonElement>("#sssdk-connect-btn")!;
    const hasStream = !!this.stream;
    const hasCode = this.getCode(modal).length === 6;
    btn.disabled = !(hasStream && hasCode);
  }

  private showConnecting(modal: HTMLElement): void {
    const btn = modal.querySelector<HTMLButtonElement>("#sssdk-connect-btn")!;
    btn.disabled = true;
    btn.classList.add("connecting");
    btn.innerHTML = `<div class="sssdk-spinner"></div> Connecting…`;
  }

  private resetConnectBtn(modal: HTMLElement): void {
    const btn = modal.querySelector<HTMLButtonElement>("#sssdk-connect-btn")!;
    btn.classList.remove("connecting");
    btn.innerHTML = "Connect";
    this.updateConnectBtn(modal);
  }

  private renderSharing(modal: HTMLElement): void {
    // Update title dot
    modal.querySelector(".sssdk-title-dot")!.classList.add("sharing");
    modal.querySelector(".sssdk-title div:last-child")?.remove();
    (
      modal.querySelector(".sssdk-title") as HTMLElement
    ).childNodes[1].textContent = "Sharing live";

    // Replace bottom controls with sharing status
    modal.querySelector(".sssdk-section-label")!.remove();
    modal.querySelector("#sssdk-code-wrapper")!.remove();
    modal.querySelector("#sssdk-error")!.remove();
    modal.querySelector(".sssdk-actions")!.remove();

    const statusDiv = document.createElement("div");
    statusDiv.className = "sssdk-sharing-status";
    statusDiv.innerHTML = `
      <div class="sssdk-sharing-info">
        <span class="sssdk-sharing-live">LIVE</span>
        <span class="sssdk-sharing-text">Screen is being shared</span>
      </div>
      <button class="sssdk-btn sssdk-btn-stop" id="sssdk-stop-btn">Stop sharing</button>
    `;
    modal.appendChild(statusDiv);

    statusDiv
      .querySelector("#sssdk-stop-btn")!
      .addEventListener("click", () => {
        this.close();
      });

    // Update preview badge
    const badge = modal.querySelector<HTMLElement>("#sssdk-badge");
    if (badge) badge.textContent = "LIVE";
  }

  private showError(modal: HTMLElement, msg: string): void {
    const el = modal.querySelector<HTMLElement>("#sssdk-error");
    if (el) el.textContent = msg;
  }
}
