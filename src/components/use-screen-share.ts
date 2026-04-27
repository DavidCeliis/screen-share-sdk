// React hook — only import in React environments

import { useState, useCallback, useRef, useEffect } from "react";
import { ScreenShareSessionManager } from "../core/session-manager";
import type {
  ScreenShareConfig,
  ScreenShareState,
  ScreenShareSession,
} from "../core/types";

export function useScreenShare(
  config?: ScreenShareConfig,
  connection?: unknown,
) {
  const [state, setState] = useState<ScreenShareState>({
    status: "idle",
    stream: null,
    error: null,
    session: null,
  });

  const managerRef = useRef<ScreenShareSessionManager | null>(null);

  const getManager = useCallback(() => {
    if (!managerRef.current) {
      const cfg: ScreenShareConfig = {
        testMode: true,
        ...config,
        onSessionStart: (id) => {
          setState((s) => ({ ...s, status: "sharing" }));
          config?.onSessionStart?.(id);
        },
        onSessionEnd: (reason) => {
          setState({
            status: "idle",
            stream: null,
            error: null,
            session: null,
          });
          config?.onSessionEnd?.(reason);
        },
        onError: (err) => {
          setState((s) => ({ ...s, status: "error", error: err }));
          config?.onError?.(err);
        },
      };
      managerRef.current = new ScreenShareSessionManager(cfg, connection);
    }
    return managerRef.current;
  }, []); // eslint-disable-line

  const requestScreen = useCallback(async () => {
    setState((s) => ({ ...s, status: "requesting_screen", error: null }));
    try {
      const stream = await getManager().requestScreen();
      setState((s) => ({ ...s, status: "preview", stream }));
      return stream;
    } catch (err: unknown) {
      setState((s) => ({ ...s, status: "error", error: err as any }));
      return null;
    }
  }, [getManager]);

  const startSession = useCallback(
    async (code: string) => {
      const { stream } = state;
      if (!stream) return null;
      setState((s) => ({ ...s, status: "connecting" }));
      try {
        const session = await getManager().startSession(stream, code);
        setState((s) => ({ ...s, session }));
        return session;
      } catch (err: unknown) {
        setState((s) => ({ ...s, status: "preview", error: err as any }));
        return null;
      }
    },
    [state.stream, getManager],
  );

  const stopSession = useCallback(() => {
    state.session?.stop();
    state.stream?.getTracks().forEach((t) => t.stop());
    setState({ status: "idle", stream: null, error: null, session: null });
  }, [state.session, state.stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      state.session?.stop();
      state.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []); // eslint-disable-line

  return { state, requestScreen, startSession, stopSession };
}
