import React, { useState, useRef, useEffect, useCallback } from "react";
import { injectStyles } from "../styles/inject";
import { resolveThemeAttr, subscribeToTheme } from "../styles/theme";
import type { ThemeMode } from "../styles/theme";
import { ScreenShareSessionManager } from "../core/session-manager";
import type { ScreenShareConfig, ScreenShareStatus } from "../core/types";

export interface ScreenShareButtonProps {
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  config?: ScreenShareConfig;
  connection?: unknown;
  /**
   * Controls color theme of the modal UI.
   * - `"auto"` (default) — follows the OS/browser preference via CSS `prefers-color-scheme`
   * - `"dark"` — always dark
   * - `"light"` — always light
   * - `"custom"` — controlled programmatically via `setThemeMode()` or `useThemeMode()`
   */
  themeMode?: ThemeMode;
  children?: (props: {
    onClick: () => void;
    isSharing: boolean;
  }) => React.ReactNode;
}

const SCREEN_ICON = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const MONITOR_BIG = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ width: 40, height: 40 }}
  >
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const REFRESH_ICON = (
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
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

export function ScreenShareButton({
  label = "Share screen",
  className,
  style,
  config,
  connection,
  themeMode = "auto",
  children,
}: ScreenShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ScreenShareStatus>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [errorMsg, setErrorMsg] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  // Tracks the resolved theme when themeMode === "custom"
  const [customTheme, setCustomTheme] = useState(() =>
    resolveThemeAttr(themeMode),
  );

  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const managerRef = useRef<ScreenShareSessionManager | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  // Persistovaný kód — drží poslední úspěšně použitý kód
  const lastCodeRef = useRef<string>("");

  useEffect(() => {
    injectStyles();
  }, []);

  // Subscribe to setThemeMode() calls when in custom mode
  useEffect(() => {
    if (themeMode !== "custom") return;
    return subscribeToTheme((t) => setCustomTheme(t));
  }, [themeMode]);

  const getManager = useCallback(() => {
    if (!managerRef.current) {
      const cfg: ScreenShareConfig = {
        testMode: true,
        testModeDelay: 1500,
        ...config,
        onSessionStart: (id) => {
          config?.onSessionStart?.(id);
          setTimeout(() => {
            setStatus("sharing");
            setOpen(false);
          }, 600);
        },
        onSessionEnd: (reason) => {
          setStatus("idle");
          setOpen(false);
          setStream(null);
          config?.onSessionEnd?.(reason);
          managerRef.current = null;
        },
      };
      managerRef.current = new ScreenShareSessionManager(cfg, connection);
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
    };
  }, [stream]);

  // ─── Screen request ────────────────────────────────────────────────────────

  const doRequestScreen = useCallback(
    async (manager: ScreenShareSessionManager) => {
      setPermissionDenied(false);
      setErrorMsg("");
      try {
        const s = await manager.requestScreen();
        setStream(s);
        setStatus("preview");
        s.getVideoTracks()[0]?.addEventListener("ended", () => {
          setStream(null);
          // Pokud sdílíme a uživatel stopne nativní lištou, zavřeme modal
          setStatus((prev) => (prev === "sharing" ? "idle" : "idle"));
          setOpen(false);
        });
        return s;
      } catch (err: unknown) {
        const e = err as { code?: string };
        if (e.code === "UNSUPPORTED") {
          setOpen(false);
        } else if (e.code === "PERMISSION_DENIED") {
          setPermissionDenied(true);
          setStatus("idle");
        }
        return null;
      }
    },
    [],
  );

  // ─── Open modal ────────────────────────────────────────────────────────────

  const handleOpen = async () => {
    // Bug fix: pokud už sdílíme, otevřeme modal v sharing stavu — ne novou flow
    if (status === "sharing") {
      setOpen(true);
      return;
    }

    setOpen(true);
    setStatus("idle");
    setPermissionDenied(false);
    setErrorMsg("");

    // Předvyplnění posledního úspěšného kódu
    if (lastCodeRef.current.length === 6) {
      setCode(lastCodeRef.current.split(""));
    } else {
      setCode(["", "", "", "", "", ""]);
    }

    const manager = getManager();
    const mode = manager.getEffectiveMode();

    if (mode === "preferCurrentTab") {
      await doRequestScreen(manager);
    }
  };

  const handleClose = () => {
    // Pokud aktivně sdílíme, nezastavujeme stream — jen zavřeme modal
    if (status !== "sharing") {
      stream?.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setOpen(false);
  };

  const handleSelectScreen = async () => {
    await doRequestScreen(getManager());
  };

  // ─── Switch stream (bez přerušení SignalR/WebRTC) ─────────────────────────

  const handleSwitchScreen = async () => {
    const manager = getManager();
    try {
      const newStream = await manager.requestScreen();

      // replaceTrack vymění video bez renegotiace WebRTC ani přerušení SignalR
      await manager.replaceVideoTrack(newStream.getVideoTracks()[0]);

      // Zastav starý stream
      stream?.getTracks().forEach((t) => t.stop());

      setStream(newStream);
      newStream.getVideoTracks()[0]?.addEventListener("ended", () => {
        setStream(null);
        setOpen(false);
        setStatus("idle");
      });
    } catch {
      // uživatel zrušil picker — nic neděláme, starý stream stále běží
    }
  };

  // ─── Connect ───────────────────────────────────────────────────────────────

  const handleConnect = async () => {
    if (!stream) return;
    const codeStr = code.join("");
    if (codeStr.length < 6) return;
    setStatus("connecting");
    setErrorMsg("");
    try {
      await getManager().startSession(stream, codeStr);
      lastCodeRef.current = codeStr; // ulož úspěšný kód
    } catch (err: unknown) {
      const e = err as { message?: string };
      setErrorMsg(e.message ?? "Nepodařilo se připojit");
      setStatus("preview");
    }
  };

  const handleStop = () => {
    stream?.getTracks().forEach((t) => t.stop());
    managerRef.current = null;
    setStatus("idle");
    setStream(null);
    setOpen(false);
  };

  // ─── Digit input helpers ───────────────────────────────────────────────────

  const handleDigitChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[idx] = digit;
    setCode(next);
    if (digit && idx < 5) digitRefs.current[idx + 1]?.focus();
  };

  const handleDigitKeyDown = (
    idx: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !code[idx] && idx > 0) {
      const next = [...code];
      next[idx - 1] = "";
      setCode(next);
      digitRefs.current[idx - 1]?.focus();
    }
    if (e.key === "Enter") {
      if (stream && code.join("").length === 6 && status === "preview")
        handleConnect();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (text.length >= 6) {
      e.preventDefault();
      setCode(text.slice(0, 6).split(""));
      digitRefs.current[5]?.focus();
    }
  };

  // ─── Derived state ─────────────────────────────────────────────────────────

  const effectiveMode = managerRef.current?.getEffectiveMode() ?? null;
  const isPreferCurrentTab = effectiveMode === "preferCurrentTab";
  const isConnectDisabled =
    !stream || code.join("").length < 6 || status === "connecting";
  const triggerIsSharing = status === "sharing";

  // ─── Render ────────────────────────────────────────────────────────────────

  const trigger = children ? (
    children({ onClick: handleOpen, isSharing: triggerIsSharing })
  ) : (
    <button
      className={[
        "sssdk-trigger-btn",
        triggerIsSharing ? "active" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style as React.CSSProperties}
      onClick={handleOpen}
    >
      {SCREEN_ICON}
      {triggerIsSharing ? "Sharing…" : label}
    </button>
  );

  return (
    <>
      {trigger}

      {open && (
        <div
          className="sssdk-overlay"
          ref={overlayRef}
          data-theme={themeMode === "custom" ? customTheme : resolveThemeAttr(themeMode)}
          data-sssdk-custom={themeMode === "custom" ? "" : undefined}
          onClick={(e) => {
            if (e.target === overlayRef.current) handleClose();
          }}
        >
          <div className="sssdk-modal">
            {/* ── Sharing stav ── */}
            {status === "sharing" ? (
              <>
                <div className="sssdk-header">
                  <div className="sssdk-title">
                    <div className="sssdk-title-dot sharing" />
                    Sdílení aktivní
                  </div>
                  <button className="sssdk-close" onClick={handleClose}>
                    ✕
                  </button>
                </div>

                <div className="sssdk-preview">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                  <div className="sssdk-preview-badge">LIVE</div>
                </div>

                <div className="sssdk-sharing-status">
                  <div className="sssdk-sharing-info">
                    <span className="sssdk-sharing-live">LIVE</span>
                    <span className="sssdk-sharing-text">
                      Obrazovka se sdílí
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="sssdk-btn sssdk-btn-secondary"
                      style={{
                        flex: 0,
                        padding: "0 14px",
                        height: 36,
                        fontSize: 13,
                      }}
                      onClick={handleSwitchScreen}
                    >
                      {SCREEN_ICON} Přepnout
                    </button>
                    <button
                      className="sssdk-btn sssdk-btn-stop"
                      onClick={handleStop}
                    >
                      Zastavit
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* ── Setup / permission denied stav ── */}
                <div className="sssdk-header">
                  <div className="sssdk-title">
                    <div
                      className={`sssdk-title-dot${status === "connecting" ? " sharing" : ""}`}
                    />
                    {status === "connecting"
                      ? "Připojuji…"
                      : "Sdílet obrazovku"}
                  </div>
                  <button className="sssdk-close" onClick={handleClose}>
                    ✕
                  </button>
                </div>

                <div className="sssdk-preview">
                  {stream ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                      />
                      <div className="sssdk-preview-badge">PREVIEW</div>
                    </>
                  ) : permissionDenied ? (
                    // Permission denied stav — zobrazíme vysvětlení a retry tlačítko
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
                        Přístup ke sdílení byl zamítnut
                      </span>
                      <span className="sssdk-permission-hint">
                        Kliknutím níže zkuste znovu. Pokud browser přístup
                        trvale blokuje, povolte sdílení v nastavení stránky.
                      </span>
                    </div>
                  ) : (
                    <div className="sssdk-preview-placeholder">
                      {MONITOR_BIG}
                      <span>
                        {isPreferCurrentTab
                          ? "Čekám na povolení sdílení…"
                          : 'Klikněte na "Vybrat obrazovku"'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="sssdk-section-label">Kód agenta</div>
                <div className="sssdk-code-input-wrapper" onPaste={handlePaste}>
                  {code.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        digitRefs.current[i] = el;
                      }}
                      className={`sssdk-code-digit${d ? " filled" : ""}`}
                      value={d}
                      maxLength={1}
                      inputMode="numeric"
                      type="text"
                      autoComplete="off"
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    />
                  ))}
                </div>
                <div className="sssdk-error-msg">{errorMsg}</div>

                <div className="sssdk-actions">
                  {/* preferCurrentTab: místo "Vybrat obrazovku" je "Zkusit znovu" jen při permission denied */}
                  {isPreferCurrentTab ? (
                    permissionDenied && (
                      <button
                        className="sssdk-btn sssdk-btn-secondary"
                        onClick={() => doRequestScreen(getManager())}
                      >
                        {REFRESH_ICON} Zkusit znovu
                      </button>
                    )
                  ) : (
                    <button
                      className="sssdk-btn sssdk-btn-secondary"
                      onClick={handleSelectScreen}
                    >
                      {SCREEN_ICON} Vybrat obrazovku
                    </button>
                  )}
                  <button
                    className={`sssdk-btn sssdk-btn-primary${status === "connecting" ? " connecting" : ""}`}
                    disabled={isConnectDisabled}
                    onClick={handleConnect}
                    style={
                      isPreferCurrentTab && !permissionDenied
                        ? { flex: 1 }
                        : undefined
                    }
                  >
                    {status === "connecting" ? (
                      <>
                        <div className="sssdk-spinner" /> Připojuji…
                      </>
                    ) : (
                      "Připojit"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
