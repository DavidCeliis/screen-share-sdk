import { injectStyles } from "../styles/inject";
import { ScreenShareModal } from "./modal-vanilla";
import type { ScreenShareConfig } from "../core/types";

export interface VanillaButtonOptions {
  /** CSS selector or HTMLElement to mount the button into */
  container: string | HTMLElement;

  /** Button label */
  label?: string;

  /** Additional CSS classes */
  className?: string;

  /** SDK configuration */
  config?: ScreenShareConfig;

  /** Existing SignalR connection */
  connection?: unknown;

  /** Custom styles as object */
  style?: Partial<CSSStyleDeclaration>;
}

const SCREEN_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
</svg>`;

/**
 * Creates and mounts a vanilla JS screen share button.
 * Use this in non-React environments.
 *
 * @example
 * import { createScreenShareButton } from 'screen-share-sdk';
 * createScreenShareButton({ container: '#my-div', config: { testMode: true } });
 */
export function createScreenShareButton(
  opts: VanillaButtonOptions,
): HTMLButtonElement {
  injectStyles();

  const container =
    typeof opts.container === "string"
      ? document.querySelector<HTMLElement>(opts.container)
      : opts.container;

  if (!container)
    throw new Error(`[ScreenShareSDK] Container not found: ${opts.container}`);

  const btn = document.createElement("button");
  btn.className = ["sssdk-trigger-btn", opts.className]
    .filter(Boolean)
    .join(" ");
  btn.innerHTML = `${SCREEN_ICON} ${opts.label ?? "Share screen"}`;

  if (opts.style) {
    Object.assign(btn.style, opts.style);
  }

  let modal: ScreenShareModal | null = null;

  btn.addEventListener("click", () => {
    if (!modal) {
      modal = new ScreenShareModal({
        config: opts.config,
        connection: opts.connection,
        onClose: () => {
          btn.classList.remove("active");
          modal = null;
        },
        onSessionStart: () => btn.classList.add("active"),
        onSessionEnd: () => {
          btn.classList.remove("active");
          modal = null;
        },
      });
    }
    modal.open();
  });

  container.appendChild(btn);
  return btn;
}
