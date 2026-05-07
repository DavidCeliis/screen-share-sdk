import React, { useState, useRef, useEffect, useCallback } from "react";
import { injectStyles } from "../styles/inject";
import { resolveThemeAttr, subscribeToTheme } from "../styles/theme";
import type { ThemeMode } from "../styles/theme";
import { ScreenViewSessionManager } from "../core/viewer-session-manager";
import type { ViewerConfig, ViewerStatus } from "../core/types";

export interface ScreenViewButtonProps {
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  config?: ViewerConfig;
  connection?: unknown;
  /**
   * Controls color theme of the modal UI.
   * - `"auto"` (default) — follows OS/browser `prefers-color-scheme`
   * - `"dark"` — always dark
   * - `"light"` — always light
   * - `"custom"` — controlled via `setThemeMode()` or `useThemeMode()`
   */
  themeMode?: ThemeMode;
  children?: (props: {
    onClick: () => void;
    isViewing: boolean;
  }) => React.ReactNode;
}

const EYE_ICON = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EYE_ICON_BIG = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ width: 40, height: 40, opacity: 0.35 }}
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const FULLSCREEN_ICON = (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  </svg>
);

const COPY_ICON = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

export function ScreenViewButton({
  label = "View screen",
  className,
  style,
  config,
  connection,
  themeMode = "auto",
  children,
}: ScreenViewButtonProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [code, setCode] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [customTheme, setCustomTheme] = useState(() =>
    resolveThemeAttr(themeMode),
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const managerRef = useRef<ScreenViewSessionManager | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    if (themeMode !== "custom") return;
    return subscribeToTheme((t) => setCustomTheme(t));
  }, [themeMode]);

  const getManager = useCallback(() => {
    if (!managerRef.current) {
      const cfg: ViewerConfig = {
        testMode: true,
        testModeDelay: 1500,
        ...config,
        onSessionStart: (sessionCode) => {
          config?.onSessionStart?.(sessionCode);
          setVideoPlaying(false);
          setStatus("viewing");
        },
        onSessionEnd: (reason) => {
          setStatus("idle");
          setCode(null);
          setStream(null);
          setOpen(false);
          config?.onSessionEnd?.(reason);
          managerRef.current = null;
        },
      };
      managerRef.current = new ScreenViewSessionManager(cfg, connection);
    }
    return managerRef.current;
  }, []); // eslint-disable-line

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, open]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      managerRef.current?.endSession("user_stopped");
    };
  }, []); // eslint-disable-line

  // ─── Register + start viewing ──────────────────────────────────────────────

  const doRegister = useCallback(async () => {
    setStatus("registering");
    setErrorMsg("");
    try {
      const sessionCode = await getManager().register();
      setCode(sessionCode);
      setStatus("connecting");
      doStartViewing(sessionCode);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setErrorMsg(e.message ?? "Registrace selhala");
      setStatus("error");
    }
  }, [getManager]); // eslint-disable-line

  const doStartViewing = useCallback(
    async (sessionCode: string) => {
      try {
        const s = await getManager().startViewing(sessionCode);
        setStream(s);
      } catch (err: unknown) {
        if (!open) return;
        const e = err as { message?: string };
        setErrorMsg(e.message ?? "Nepodařilo se připojit");
        setStatus("error");
      }
    },
    [getManager, open],
  );

  // ─── Open / close ─────────────────────────────────────────────────────────

  const handleOpen = () => {
    if (status === "viewing") {
      setOpen(true);
      return;
    }
    setOpen(true);
    setStatus("idle");
    setErrorMsg("");
  };

  const handleClose = () => {
    if (status !== "viewing") {
      getManager().endSession("user_stopped");
      managerRef.current = null;
      setStatus("idle");
      setCode(null);
    }
    setOpen(false);
  };

  const handleStop = () => {
    stream?.getTracks().forEach((t) => t.stop());
    getManager().endSession("user_stopped");
    managerRef.current = null;
    setStream(null);
    setStatus("idle");
    setCode(null);
    setOpen(false);
  };

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFullscreen = () => {
    videoRef.current?.requestFullscreen?.().catch(() => {});
  };

  const handleRetry = () => {
    setStatus("idle");
    setCode(null);
    setErrorMsg("");
  };

  // ─── Derived ───────────────────────────────────────────────────────────────

  const isViewing = status === "viewing";

  // ─── Render ────────────────────────────────────────────────────────────────

  const trigger = children ? (
    children({ onClick: handleOpen, isViewing })
  ) : (
    <button
      className={[
        "sssdk-trigger-btn",
        isViewing ? "active" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      onClick={handleOpen}
    >
      {EYE_ICON}
      {isViewing ? "Viewing…" : label}
    </button>
  );

  return (
    <>
      {trigger}

      {open && (
        <div
          className="sssdk-overlay"
          ref={overlayRef}
          data-theme={
            themeMode === "custom"
              ? customTheme
              : resolveThemeAttr(themeMode)
          }
          data-sssdk-custom={themeMode === "custom" ? "" : undefined}
          onClick={(e) => {
            if (e.target === overlayRef.current) handleClose();
          }}
        >
          <div className="sssdk-modal">
            {/* ── Viewing stav ── */}
            {status === "viewing" ? (
              <>
                <div className="sssdk-header">
                  <div className="sssdk-title">
                    <div className="sssdk-title-dot sharing" />
                    Příchozí obraz
                  </div>
                  <button className="sssdk-close" onClick={handleClose}>
                    ✕
                  </button>
                </div>

                <div className="sssdk-preview">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    onPlaying={() => setVideoPlaying(true)}
                  />
                  {!videoPlaying && (
                    <div
                      className="sssdk-preview-placeholder"
                      style={{ position: "absolute", inset: 0, background: "transparent" }}
                    >
                      <div className="sssdk-spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
                      <span style={{ fontSize: 13 }}>Navazuji P2P spojení…</span>
                    </div>
                  )}
                  {videoPlaying && <div className="sssdk-preview-badge">LIVE</div>}
                </div>

                <div className="sssdk-sharing-status">
                  <div className="sssdk-sharing-info">
                    <span className="sssdk-sharing-live">LIVE</span>
                    <span className="sssdk-sharing-text">
                      Zobrazuji obrazovku klienta
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="sssdk-btn sssdk-btn-secondary"
                      style={{ flex: 0, padding: "0 14px", height: 36, fontSize: 13 }}
                      onClick={handleFullscreen}
                    >
                      {FULLSCREEN_ICON} Fullscreen
                    </button>
                    <button
                      className="sssdk-btn sssdk-btn-stop"
                      onClick={handleStop}
                    >
                      Ukončit
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* ── Idle / registering / waiting / error stav ── */}
                <div className="sssdk-header">
                  <div className="sssdk-title">
                    <div
                      className={`sssdk-title-dot${status === "connecting" ? " sharing" : ""}`}
                    />
                    {status === "connecting"
                      ? "Čekám na klienta…"
                      : status === "registering"
                        ? "Generuji kód…"
                        : "Zobrazit obrazovku"}
                  </div>
                  <button className="sssdk-close" onClick={handleClose}>
                    ✕
                  </button>
                </div>

                <div className="sssdk-preview">
                  {status === "connecting" && code ? (
                    <div className="sssdk-viewer-waiting">
                      <div
                        className="sssdk-section-label"
                        style={{ marginBottom: 14 }}
                      >
                        Kód pro klienta
                      </div>
                      <div className="sssdk-viewer-code-display">
                        {code.split("").map((d, i) => (
                          <div key={i} className="sssdk-viewer-code-digit">
                            {d}
                          </div>
                        ))}
                      </div>
                      <button
                        className="sssdk-viewer-copy-btn"
                        onClick={handleCopy}
                      >
                        {COPY_ICON}{" "}
                        {copied ? "✓ Zkopírováno" : "Kopírovat kód"}
                      </button>
                      <div className="sssdk-viewer-waiting-status">
                        <div className="sssdk-waiting-dots">
                          <span />
                          <span />
                          <span />
                        </div>
                        <span>Čekám na klienta…</span>
                      </div>
                    </div>
                  ) : status === "error" ? (
                    <div className="sssdk-preview-placeholder">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ width: 40, height: 40, opacity: 0.7 }}
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4m0 4h.01" />
                      </svg>
                      <span style={{ color: "#ef4444", fontSize: 13 }}>
                        {errorMsg}
                      </span>
                    </div>
                  ) : (
                    <div className="sssdk-preview-placeholder">
                      {EYE_ICON_BIG}
                      <span>Klikněte na tlačítko pro zahájení</span>
                    </div>
                  )}
                </div>

                <div className="sssdk-actions" style={{ marginTop: 4 }}>
                  {status === "connecting" ? (
                    <button
                      className="sssdk-btn sssdk-btn-secondary"
                      style={{ flex: 1 }}
                      onClick={handleClose}
                    >
                      Zrušit
                    </button>
                  ) : status === "error" ? (
                    <>
                      <button
                        className="sssdk-btn sssdk-btn-secondary"
                        style={{ flex: 1 }}
                        onClick={handleClose}
                      >
                        Zavřít
                      </button>
                      <button
                        className="sssdk-btn sssdk-btn-primary"
                        style={{ flex: 1 }}
                        onClick={handleRetry}
                      >
                        Zkusit znovu
                      </button>
                    </>
                  ) : (
                    <button
                      className={`sssdk-btn sssdk-btn-primary${status === "registering" ? " connecting" : ""}`}
                      disabled={status === "registering"}
                      style={{ flex: 1 }}
                      onClick={doRegister}
                    >
                      {status === "registering" ? (
                        <>
                          <div className="sssdk-spinner" /> Generuji kód…
                        </>
                      ) : (
                        "Vygenerovat kód"
                      )}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
