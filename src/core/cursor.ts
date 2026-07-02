// Remote cursor sharing — protocol + helpers for both sides of the connection.
//
// Direction: viewer (agent/operátor) → sharer (client/zákazník).
// Positions travel over a dedicated RTCDataChannel labeled "cursor"
// (created by the sharer as the offerer, unreliable/unordered for low latency).
//
// Coordinates are normalized to 0..1 relative to the captured frame, so they
// are independent of video scaling on either side.

export const CURSOR_CHANNEL_LABEL = "cursor";

export type CursorMessage =
  | { t: "move"; x: number; y: number }
  | { t: "hide" };

export function parseCursorMessage(data: unknown): CursorMessage | null {
  if (typeof data !== "string") return null;
  try {
    const msg = JSON.parse(data);
    if (msg?.t === "hide") return { t: "hide" };
    if (
      msg?.t === "move" &&
      typeof msg.x === "number" &&
      typeof msg.y === "number"
    ) {
      return { t: "move", x: msg.x, y: msg.y };
    }
  } catch {
    /* malformed message — ignore */
  }
  return null;
}

// ─── Sharer side: cursor overlay rendering ──────────────────────────────────

export interface RemoteCursorOptions {
  /** Set to false to ignore incoming cursor positions. Default: true */
  enabled?: boolean;
  /** Cursor color (any CSS color). Default: "#ef4444" */
  color?: string;
  /** Cursor size in px (height of the arrow). Default: 22 */
  size?: number;
  /** Optional label shown next to the cursor (e.g. operator name) */
  label?: string;
  /** Hide the cursor after this many ms without updates. Default: 3000 */
  hideAfterMs?: number;
}

const CURSOR_Z_INDEX = 2147483647;

/**
 * Renders the remote operator's cursor as a DOM overlay on the sharer's page.
 * Positions are normalized (0..1) relative to the viewport — correct when the
 * current tab is being shared (the primary use case). When a different
 * window/monitor is shared, the overlay still renders on the page but cannot
 * point outside of it.
 */
export class RemoteCursorRenderer {
  private el: HTMLElement | null = null;
  private opts: Required<Omit<RemoteCursorOptions, "label">> & { label?: string };
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: RemoteCursorOptions = {}) {
    this.opts = {
      enabled: opts.enabled ?? true,
      color: opts.color ?? "#ef4444",
      size: opts.size ?? 22,
      label: opts.label,
      hideAfterMs: opts.hideAfterMs ?? 3000,
    };
  }

  handleMessage(msg: CursorMessage): void {
    if (!this.opts.enabled) return;
    if (msg.t === "move") {
      this.move(msg.x, msg.y);
    } else {
      this.hide();
    }
  }

  move(x: number, y: number): void {
    const el = this.ensureElement();
    const px = Math.min(Math.max(x, 0), 1) * window.innerWidth;
    const py = Math.min(Math.max(y, 0), 1) * window.innerHeight;
    el.style.transform = `translate3d(${px}px, ${py}px, 0)`;
    el.style.opacity = "1";

    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hide(), this.opts.hideAfterMs);
  }

  hide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (this.el) this.el.style.opacity = "0";
  }

  destroy(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
    this.el?.remove();
    this.el = null;
  }

  private ensureElement(): HTMLElement {
    if (this.el) return this.el;

    const { color, size, label } = this.opts;
    const el = document.createElement("div");
    el.setAttribute("data-sssdk-remote-cursor", "");
    el.style.cssText = [
      "position:fixed",
      "left:0",
      "top:0",
      `z-index:${CURSOR_Z_INDEX}`,
      "pointer-events:none",
      "opacity:0",
      "transition:transform 60ms linear, opacity 200ms ease",
      "will-change:transform",
    ].join(";");

    // Arrow cursor shape (same silhouette as a standard pointer)
    el.innerHTML = `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24"
        style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">
        <path d="M4 2 L4 19 L8.6 15.2 L11.3 21.4 L14.2 20.1 L11.5 14 L17.5 14 Z"
          fill="${color}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>
      </svg>
      ${label ? `
      <div style="
        position:absolute;left:${Math.round(size * 0.8)}px;top:${Math.round(size * 0.95)}px;
        background:${color};color:#fff;font:600 11px/1 sans-serif;
        padding:4px 7px;border-radius:4px;white-space:nowrap;
        box-shadow:0 1px 3px rgba(0,0,0,.3)">${escapeHtml(label)}</div>` : ""}
    `;

    document.body.appendChild(el);
    this.el = el;
    return el;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Viewer side: track mouse over the <video> element ──────────────────────

const SEND_INTERVAL_MS = 33; // ~30 Hz

/**
 * Tracks mouse movement over a <video> element and reports positions
 * normalized to the actual video content (compensates for the letterbox
 * created by object-fit: contain). Sends {t:"hide"} when the mouse leaves
 * the video or moves into the letterbox area.
 *
 * Returns a cleanup function that detaches the listeners and hides the cursor.
 */
export function attachCursorTracking(
  video: HTMLVideoElement,
  send: (msg: CursorMessage) => void,
): () => void {
  let lastSent = 0;
  let overContent = false;

  const onMove = (e: MouseEvent) => {
    const now = performance.now();
    if (now - lastSent < SEND_INTERVAL_MS) return;

    const pos = mapToVideoContent(video, e.clientX, e.clientY);
    if (!pos) {
      if (overContent) {
        overContent = false;
        send({ t: "hide" });
      }
      return;
    }
    lastSent = now;
    overContent = true;
    send({ t: "move", x: pos.x, y: pos.y });
  };

  const onLeave = () => {
    if (overContent) {
      overContent = false;
      send({ t: "hide" });
    }
  };

  video.addEventListener("mousemove", onMove);
  video.addEventListener("mouseleave", onLeave);

  return () => {
    video.removeEventListener("mousemove", onMove);
    video.removeEventListener("mouseleave", onLeave);
    if (overContent) {
      overContent = false;
      send({ t: "hide" });
    }
  };
}

/**
 * Maps client coordinates to normalized (0..1) coordinates within the video
 * content rendered inside the element (object-fit: contain). Returns null
 * when the point falls into the letterbox or metadata is not loaded yet.
 */
function mapToVideoContent(
  video: HTMLVideoElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const rect = video.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const scale = Math.min(rect.width / vw, rect.height / vh);
  const contentW = vw * scale;
  const contentH = vh * scale;
  const offsetX = rect.left + (rect.width - contentW) / 2;
  const offsetY = rect.top + (rect.height - contentH) / 2;

  const x = (clientX - offsetX) / contentW;
  const y = (clientY - offsetY) / contentH;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;

  return { x, y };
}
