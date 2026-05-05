const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');

.sssdk-overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 8, 12, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999999;
  font-family: 'DM Sans', system-ui, sans-serif;
  animation: sssdk-fade-in 0.2s ease;
}

.sssdk-modal {
  background: #0f0f14;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  padding: 28px;
  width: min(520px, calc(100vw - 32px));
  box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
  animation: sssdk-slide-up 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  color: #e8e8f0;
}

.sssdk-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.sssdk-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #e8e8f0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sssdk-title-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3b82f6;
}

.sssdk-title-dot.sharing {
  background: #22c55e;
  box-shadow: 0 0 8px #22c55e;
  animation: sssdk-pulse 1.5s ease infinite;
}

.sssdk-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  color: #888;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  line-height: 1;
  transition: all 0.15s;
}

.sssdk-close:hover {
  background: rgba(255,255,255,0.1);
  color: #e8e8f0;
}

.sssdk-preview {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 12px;
  background: #1a1a24;
  border: 1px solid rgba(255,255,255,0.06);
  overflow: hidden;
  position: relative;
  margin-bottom: 20px;
}

.sssdk-preview video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.sssdk-preview-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #444;
}

.sssdk-preview-placeholder svg {
  width: 40px;
  height: 40px;
  opacity: 0.4;
}

.sssdk-preview-placeholder span {
  font-size: 13px;
  color: #555;
}

.sssdk-preview-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0,0,0,0.7);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  font-family: 'DM Mono', monospace;
  color: #22c55e;
  display: flex;
  align-items: center;
  gap: 5px;
}

.sssdk-preview-badge::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e;
  animation: sssdk-pulse 1.5s ease infinite;
}

.sssdk-section-label {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #555;
  margin-bottom: 10px;
}

.sssdk-code-input-wrapper {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  justify-content: center;
}

.sssdk-code-digit {
  width: 52px;
  height: 58px;
  border-radius: 12px;
  border: 1.5px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  color: #e8e8f0;
  font-size: 24px;
  font-family: 'DM Mono', monospace;
  font-weight: 500;
  text-align: center;
  outline: none;
  transition: all 0.15s;
  caret-color: transparent;
}

.sssdk-code-digit:focus {
  border-color: #3b82f6;
  background: rgba(59,130,246,0.06);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
}

.sssdk-code-digit.filled {
  border-color: rgba(59,130,246,0.4);
  background: rgba(59,130,246,0.06);
}

.sssdk-code-digit.error {
  border-color: #ef4444;
  background: rgba(239,68,68,0.06);
  animation: sssdk-shake 0.3s ease;
}

.sssdk-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.sssdk-btn {
  flex: 1;
  height: 44px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.sssdk-btn-secondary {
  background: rgba(255,255,255,0.06);
  color: #888;
  border: 1px solid rgba(255,255,255,0.08);
}

.sssdk-btn-secondary:hover {
  background: rgba(255,255,255,0.1);
  color: #ccc;
}

.sssdk-btn-primary {
  background: #3b82f6;
  color: #fff;
  box-shadow: 0 4px 16px rgba(59,130,246,0.3);
}

.sssdk-btn-primary:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(59,130,246,0.4);
}

.sssdk-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sssdk-btn-primary.connecting {
  background: #1d4ed8;
}

.sssdk-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: sssdk-spin 0.7s linear infinite;
}

.sssdk-error-msg {
  font-size: 12px;
  color: #ef4444;
  text-align: center;
  margin-top: 10px;
  min-height: 16px;
}

.sssdk-sharing-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(34,197,94,0.08);
  border: 1px solid rgba(34,197,94,0.2);
  border-radius: 12px;
  padding: 14px 16px;
  margin-top: 4px;
}

.sssdk-sharing-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sssdk-sharing-live {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #22c55e;
  background: rgba(34,197,94,0.15);
  padding: 3px 8px;
  border-radius: 4px;
}

.sssdk-sharing-text {
  font-size: 13px;
  color: #aaa;
}

.sssdk-btn-stop {
  background: rgba(239,68,68,0.1);
  color: #ef4444;
  border: 1px solid rgba(239,68,68,0.2);
  height: 36px;
  flex: 0;
  padding: 0 16px;
  white-space: nowrap;
}

.sssdk-btn-stop:hover {
  background: rgba(239,68,68,0.2);
}

/* Default trigger button */
.sssdk-trigger-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 4px 12px rgba(59,130,246,0.3);
}

.sssdk-trigger-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(59,130,246,0.4);
}

.sssdk-trigger-btn.active {
  background: #22c55e;
  box-shadow: 0 4px 12px rgba(34,197,94,0.3);
}

@keyframes sssdk-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes sssdk-slide-up {
  from { opacity: 0; transform: translateY(20px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes sssdk-spin {
  to { transform: rotate(360deg); }
}

@keyframes sssdk-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@keyframes sssdk-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

/* ─── Toast ──────────────────────────────────────────────────── */

.sssdk-toast-container {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  pointer-events: none;
  font-family: 'DM Sans', system-ui, sans-serif;
}

.sssdk-toast {
  background: #0f0f14;
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 12px;
  padding: 12px 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #e8e8f0;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
  animation: sssdk-toast-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  white-space: nowrap;
  pointer-events: auto;
}

.sssdk-toast.sssdk-toast-warning {
  border-color: rgba(251,146,60,0.3);
}

.sssdk-toast.sssdk-toast-error {
  border-color: rgba(239,68,68,0.3);
}

.sssdk-toast-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sssdk-toast-warning .sssdk-toast-dot { background: #fb923c; }
.sssdk-toast-error .sssdk-toast-dot { background: #ef4444; }

@keyframes sssdk-toast-in {
  from { opacity: 0; transform: translateY(12px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes sssdk-toast-out {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to { opacity: 0; transform: translateY(8px) scale(0.95); }
}

/* ─── Viewer / Agent side ─────────────────────────────────────── */

.sssdk-viewer-waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0;
  padding: 24px 16px;
}

.sssdk-viewer-code-display {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 16px;
}

.sssdk-viewer-code-digit {
  width: 52px;
  height: 58px;
  border-radius: 12px;
  border: 1.5px solid rgba(59,130,246,0.5);
  background: rgba(59,130,246,0.08);
  color: #e8e8f0;
  font-size: 26px;
  font-family: 'DM Mono', monospace;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.sssdk-viewer-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  color: #888;
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 13px;
  padding: 6px 14px;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 20px;
}

.sssdk-viewer-copy-btn:hover {
  background: rgba(255,255,255,0.1);
  color: #ccc;
}

.sssdk-viewer-waiting-status {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #555;
  font-size: 13px;
}

.sssdk-waiting-dots {
  display: flex;
  gap: 4px;
}

.sssdk-waiting-dots span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #3b82f6;
  animation: sssdk-dot-bounce 1.2s ease infinite;
}

.sssdk-waiting-dots span:nth-child(2) { animation-delay: 0.2s; }
.sssdk-waiting-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes sssdk-dot-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.3; }
  40% { transform: translateY(-5px); opacity: 1; }
}
`;

let injected = false;

export function injectStyles(): void {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const style = document.createElement("style");
  style.setAttribute("data-sssdk", "1");
  style.textContent = STYLES;
  document.head.appendChild(style);
}

export function showToast(
  message: string,
  type: "warning" | "error" = "warning",
  duration = 5000,
): void {
  if (typeof document === "undefined") return;

  let container = document.querySelector<HTMLElement>(".sssdk-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "sssdk-toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `sssdk-toast sssdk-toast-${type}`;
  toast.innerHTML = `<div class="sssdk-toast-dot"></div><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "sssdk-toast-out 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
