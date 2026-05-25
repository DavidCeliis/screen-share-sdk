import { injectStyles } from "../styles/inject";
import { ScreenViewModal } from "./viewer-modal-vanilla";
import type { ThemeMode } from "../styles/theme";
import type { ViewerConfig } from "../core/types";
import { t, subscribeToLocale } from "../i18n";

export interface ViewerButtonOptions {
  container: string | HTMLElement;
  label?: string;
  className?: string;
  config?: ViewerConfig;
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

const EYE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;

export function createScreenViewButton(opts: ViewerButtonOptions): HTMLButtonElement {
  injectStyles();

  const container =
    typeof opts.container === "string"
      ? document.querySelector<HTMLElement>(opts.container)
      : opts.container;

  if (!container) throw new Error(`[ScreenShareSDK] Container not found: ${opts.container}`);

  const btn = document.createElement("button");
  btn.className = ["sssdk-trigger-btn", opts.className].filter(Boolean).join(" ");
  btn.innerHTML = `${EYE_ICON} ${opts.label ?? t('view.buttonIdle')}`;

  if (opts.style) Object.assign(btn.style, opts.style);

  let isActive = false;

  const updateLabel = () => {
    btn.innerHTML = isActive
      ? `${EYE_ICON} ${t('view.buttonActive')}`
      : `${EYE_ICON} ${opts.label ?? t('view.buttonIdle')}`;
  };

  const modal = new ScreenViewModal({
    config: opts.config,
    connection: opts.connection,
    themeMode: opts.themeMode,
    onSessionStart: () => {
      isActive = true;
      btn.classList.add("active");
      updateLabel();
    },
    onSessionEnd: () => {
      isActive = false;
      btn.classList.remove("active");
      updateLabel();
    },
  });

  subscribeToLocale(updateLabel);

  btn.addEventListener("click", () => modal.open());

  container.appendChild(btn);
  return btn;
}
