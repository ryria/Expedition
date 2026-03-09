import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { disconnectConnection, initConnection } from "./connection";

export type ConnectionPhase =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline"
  | "inactive"
  | "background"
  | "error";

interface ConnectionHandlerState {
  phase: ConnectionPhase;
  lastError: string | null;
  hasConnectedOnce: boolean;
  retryNow: () => void;
}

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 15_000;

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function useConnectionHandler(token?: string): ConnectionHandlerState {
  const [phase, setPhase] = useState<ConnectionPhase>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false);

  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);
  const inactiveRef = useRef(false);
  const hasConnectedOnceRef = useRef(false);
  const tokenRef = useRef<string | undefined>(token);
  const phaseRef = useRef<ConnectionPhase>("idle");

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    hasConnectedOnceRef.current = hasConnectedOnce;
  }, [hasConnectedOnce]);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const startInactivityTimer = useCallback(() => {
    clearInactivityTimer();
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }

    inactivityTimerRef.current = setTimeout(() => {
      inactiveRef.current = true;
      disconnectConnection();
      setPhase("inactive");
    }, INACTIVITY_TIMEOUT_MS);
  }, [clearInactivityTimer]);

  const connect = useCallback(
    (kind: "initial" | "reconnect") => {
      const currentToken = tokenRef.current;

      if (!currentToken) {
        setPhase("idle");
        return;
      }

      if (!isOnline()) {
        setPhase("offline");
        return;
      }

      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        setPhase("background");
        return;
      }

      setLastError(null);
      setPhase(kind === "initial" && !hasConnectedOnceRef.current ? "connecting" : "reconnecting");

      try {
        initConnection(
          () => {
            retryAttemptRef.current = 0;
            inactiveRef.current = false;
            hasConnectedOnceRef.current = true;
            setHasConnectedOnce(true);
            setLastError(null);
            setPhase("connected");
            startInactivityTimer();
          },
          (err) => {
            setLastError(err.message);

            if (!hasConnectedOnceRef.current && kind === "initial") {
              setPhase("error");
              return;
            }

            setPhase(isOnline() ? "reconnecting" : "offline");
          },
          currentToken,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setLastError(message);
        setPhase(hasConnectedOnceRef.current ? "reconnecting" : "error");
      }
    },
    [startInactivityTimer],
  );

  const scheduleReconnect = useCallback(() => {
    clearRetryTimer();
    if (!tokenRef.current) return;
    if (!isOnline()) return;
    if (inactiveRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

    const delay = Math.min(RETRY_BASE_MS * 2 ** retryAttemptRef.current, RETRY_MAX_MS);
    retryAttemptRef.current += 1;

    retryTimerRef.current = setTimeout(() => {
      connect("reconnect");
    }, delay);
  }, [clearRetryTimer, connect]);

  useEffect(() => {
    if (!token) {
      clearRetryTimer();
      clearInactivityTimer();
      retryAttemptRef.current = 0;
      inactiveRef.current = false;
      hasConnectedOnceRef.current = false;
      setHasConnectedOnce(false);
      setLastError(null);
      setPhase("idle");
      disconnectConnection();
      return;
    }

    connect("initial");
  }, [token, clearInactivityTimer, clearRetryTimer, connect]);

  useEffect(() => {
    return () => {
      clearRetryTimer();
      clearInactivityTimer();
      disconnectConnection();
    };
  }, [clearInactivityTimer, clearRetryTimer]);

  useEffect(() => {
    if (phase === "connected") {
      startInactivityTimer();
      return;
    }

    if (phase === "reconnecting") {
      scheduleReconnect();
      return;
    }

    clearRetryTimer();
    clearInactivityTimer();
  }, [clearInactivityTimer, clearRetryTimer, phase, scheduleReconnect, startInactivityTimer]);

  useEffect(() => {
    const onOnline = () => {
      if (!token) return;
      if (inactiveRef.current) return;
      if (phaseRef.current === "connected" || phaseRef.current === "connecting") return;
      connect("reconnect");
    };

    const onOffline = () => {
      disconnectConnection();
      setPhase("offline");
    };

    const onVisibilityChange = () => {
      if (!token) return;

      if (document.visibilityState === "hidden") {
        setPhase("background");
        clearRetryTimer();
        clearInactivityTimer();
        return;
      }

      if (inactiveRef.current) return;
      if (phaseRef.current === "connected" || phaseRef.current === "connecting") {
        startInactivityTimer();
        return;
      }
      connect("reconnect");
    };

    const onPageHide = () => {
      disconnectConnection();
      setPhase("background");
    };

    const onActivity = () => {
      if (!token) return;
      if (inactiveRef.current) {
        inactiveRef.current = false;
        connect("reconnect");
        return;
      }

      if (phase === "connected") {
        startInactivityTimer();
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    const activityEvents: Array<keyof WindowEventMap> = [
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "pointerdown",
      "focus",
    ];

    for (const evt of activityEvents) {
      window.addEventListener(evt, onActivity, { passive: true });
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);

      for (const evt of activityEvents) {
        window.removeEventListener(evt, onActivity);
      }
    };
  }, [clearInactivityTimer, clearRetryTimer, connect, startInactivityTimer, token]);

  const retryNow = useCallback(() => {
    inactiveRef.current = false;
    retryAttemptRef.current = 0;
    connect("reconnect");
  }, [connect]);

  return useMemo(
    () => ({ phase, lastError, hasConnectedOnce, retryNow }),
    [hasConnectedOnce, lastError, phase, retryNow],
  );
}
