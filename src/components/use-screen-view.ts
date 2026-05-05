import { useState, useCallback, useRef, useEffect } from "react";
import { ScreenViewSessionManager } from "../core/viewer-session-manager";
import type { ViewerConfig, ViewerState } from "../core/types";

export function useScreenView(config?: ViewerConfig, connection?: unknown) {
  const [state, setState] = useState<ViewerState>({
    status: "idle",
    code: null,
    stream: null,
    error: null,
  });

  const managerRef = useRef<ScreenViewSessionManager | null>(null);

  const getManager = useCallback(() => {
    if (!managerRef.current) {
      const cfg: ViewerConfig = {
        testMode: true,
        ...config,
        onSessionStart: (code) => {
          setState((s) => ({ ...s, status: "viewing" }));
          config?.onSessionStart?.(code);
        },
        onSessionEnd: (reason) => {
          setState({ status: "idle", code: null, stream: null, error: null });
          config?.onSessionEnd?.(reason);
        },
        onError: (err) => {
          setState((s) => ({ ...s, status: "error", error: err }));
          config?.onError?.(err);
        },
      };
      managerRef.current = new ScreenViewSessionManager(cfg, connection);
    }
    return managerRef.current;
  }, []); // eslint-disable-line

  const register = useCallback(async () => {
    setState((s) => ({ ...s, status: "registering", error: null }));
    try {
      const code = await getManager().register();
      setState((s) => ({ ...s, status: "waiting", code }));
      return code;
    } catch (err: unknown) {
      setState((s) => ({ ...s, status: "error", error: err as any }));
      return null;
    }
  }, [getManager]);

  const startViewing = useCallback(
    async (code: string) => {
      setState((s) => ({ ...s, status: "connecting" }));
      try {
        const stream = await getManager().startViewing(code);
        setState((s) => ({ ...s, stream }));
        return stream;
      } catch (err: unknown) {
        setState((s) => ({ ...s, status: "error", error: err as any }));
        return null;
      }
    },
    [getManager],
  );

  const stopViewing = useCallback(() => {
    state.stream?.getTracks().forEach((t) => t.stop());
    getManager().endSession("user_stopped");
    setState({ status: "idle", code: null, stream: null, error: null });
  }, [state.stream, getManager]);

  useEffect(() => {
    return () => {
      state.stream?.getTracks().forEach((t) => t.stop());
      managerRef.current?.endSession("user_stopped");
    };
  }, []); // eslint-disable-line

  return { state, register, startViewing, stopViewing };
}
