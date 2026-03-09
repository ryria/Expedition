import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { disconnectConnection, initConnection, isConnectionReady } from "./connection";

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
const CONNECTION_DEBUG =
  import.meta.env.DEV &&
  (import.meta.env.VITE_STDB_CONN_DEBUG === "1" ||
    import.meta.env.VITE_STDB_CONN_DEBUG === "true");

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function isTransientVisibilityError(message: string): boolean {
  return (
    message.includes("browser lifecycle event") ||
    message.includes("WebSocket is closed before the connection is established") ||
    message.includes("connection timed out")
  );
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
  const sessionStartedRef = useRef(false);
  const connectSequenceRef = useRef(0);
  const connectInFlightRef = useRef(false);

  const debugLog = useCallback((event: string, details?: Record<string, unknown>) => {
    if (!CONNECTION_DEBUG) return;
    const payload = {
      phase: phaseRef.current,
      retryAttempt: retryAttemptRef.current,
      ...details,
    };
    console.log(`[ConnDebug] ${event}`, payload);
  }, []);

  const setPhaseSafe = useCallback((next: ConnectionPhase) => {
    if (CONNECTION_DEBUG && phaseRef.current !== next) {
      console.log("[ConnDebug] phase", { from: phaseRef.current, to: next });
    }
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

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
    (kind: "initial" | "reconnect", reason: string) => {
      const currentToken = tokenRef.current;
      const sequence = ++connectSequenceRef.current;
      debugLog("connect.request", { sequence, kind, reason, hasToken: Boolean(currentToken) });

      if (phaseRef.current === "connecting" || phaseRef.current === "reconnecting") {
        debugLog("connect.skip", { sequence, why: "already-connecting" });
        return;
      }

      if (connectInFlightRef.current) {
        debugLog("connect.skip", { sequence, why: "connect-in-flight" });
        return;
      }

      if (phaseRef.current === "connected" && kind === "reconnect") {
        debugLog("connect.skip", { sequence, why: "already-connected" });
        return;
      }

      if (!currentToken) {
        debugLog("connect.skip", { sequence, why: "missing-token" });
        setPhaseSafe("idle");
        return;
      }

      if (!isOnline()) {
        debugLog("connect.skip", { sequence, why: "offline" });
        setPhaseSafe("offline");
        return;
      }

      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        debugLog("connect.skip", { sequence, why: "hidden" });
        setPhaseSafe("background");
        return;
      }

      setLastError(null);
      setPhaseSafe(kind === "initial" && !hasConnectedOnceRef.current ? "connecting" : "reconnecting");
      connectInFlightRef.current = true;

      try {
        initConnection(
          () => {
            connectInFlightRef.current = false;
            debugLog("connect.success", { sequence });
            retryAttemptRef.current = 0;
            inactiveRef.current = false;
            hasConnectedOnceRef.current = true;
            setHasConnectedOnce(true);
            setLastError(null);
            setPhaseSafe("connected");
            startInactivityTimer();
          },
          (err) => {
            connectInFlightRef.current = false;
            debugLog("connect.error-callback", { sequence, message: err.message });

            const hidden =
              typeof document !== "undefined" && document.visibilityState === "hidden";
            const inBackgroundPhase = phaseRef.current === "background";
            if ((hidden || inBackgroundPhase) && isTransientVisibilityError(err.message)) {
              debugLog("connect.error-transient", {
                sequence,
                message: err.message,
                hidden,
                inBackgroundPhase,
              });
              setPhaseSafe("background");
              return;
            }

            setLastError(err.message);

            if (!hasConnectedOnceRef.current && kind === "initial") {
              setPhaseSafe("error");
              return;
            }

            setPhaseSafe(isOnline() ? "reconnecting" : "offline");
          },
          currentToken,
        );
      } catch (err) {
        connectInFlightRef.current = false;
        const message = err instanceof Error ? err.message : String(err);
        debugLog("connect.error-throw", { sequence, message });

        const hidden =
          typeof document !== "undefined" && document.visibilityState === "hidden";
        const inBackgroundPhase = phaseRef.current === "background";
        if ((hidden || inBackgroundPhase) && isTransientVisibilityError(message)) {
          debugLog("connect.throw-transient", {
            sequence,
            message,
            hidden,
            inBackgroundPhase,
          });
          setPhaseSafe("background");
          return;
        }

        setLastError(message);
        setPhaseSafe(hasConnectedOnceRef.current ? "reconnecting" : "error");
      }
    },
    [debugLog, setPhaseSafe, startInactivityTimer],
  );

  const scheduleReconnect = useCallback(() => {
    clearRetryTimer();
    if (!tokenRef.current) return;
    if (!isOnline()) return;
    if (inactiveRef.current) return;
    if (connectInFlightRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

    const delay = Math.min(RETRY_BASE_MS * 2 ** retryAttemptRef.current, RETRY_MAX_MS);
    retryAttemptRef.current += 1;
    debugLog("reconnect.scheduled", { delayMs: delay, attempt: retryAttemptRef.current });

    retryTimerRef.current = setTimeout(() => {
      connect("reconnect", "scheduled-retry");
    }, delay);
  }, [clearRetryTimer, connect, debugLog]);

  useEffect(() => {
    if (!token) {
      sessionStartedRef.current = false;
      clearRetryTimer();
      clearInactivityTimer();
      retryAttemptRef.current = 0;
      inactiveRef.current = false;
      hasConnectedOnceRef.current = false;
      setHasConnectedOnce(false);
      setLastError(null);
      setPhaseSafe("idle");
      debugLog("session.reset");
      disconnectConnection();
      return;
    }

    if (sessionStartedRef.current) {
      debugLog("session.skip-initial", { why: "already-started" });
      return;
    }

    sessionStartedRef.current = true;
    connect("initial", "session-start");
  }, [token, clearInactivityTimer, clearRetryTimer, connect, debugLog, setPhaseSafe]);

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
      debugLog("event.online");
      connect("reconnect", "network-online");
    };

    const onOffline = () => {
      debugLog("event.offline");
      disconnectConnection();
      setPhaseSafe("offline");
    };

    const onVisibilityChange = () => {
      if (!token) return;
      debugLog("event.visibility", { state: document.visibilityState });

      if (document.visibilityState === "hidden") {
        connectInFlightRef.current = false;
        disconnectConnection();
        setPhaseSafe("background");
        clearRetryTimer();
        clearInactivityTimer();
        return;
      }

      if (inactiveRef.current) return;
      if (phaseRef.current === "background" && isConnectionReady()) {
        debugLog("event.visibility-resume-active");
        setPhaseSafe("connected");
        startInactivityTimer();
        return;
      }
      if (phaseRef.current === "background" && connectInFlightRef.current) {
        debugLog("event.visibility-pending-connect");
        setPhaseSafe(hasConnectedOnceRef.current ? "reconnecting" : "connecting");
        return;
      }
      if (phaseRef.current === "connected" || phaseRef.current === "connecting") {
        startInactivityTimer();
        return;
      }
      connect("reconnect", "visibility-visible");
    };

    const onPageHide = () => {
      debugLog("event.pagehide");
      disconnectConnection();
      setPhaseSafe("background");
    };

    const onActivity = () => {
      if (!token) return;
      if (inactiveRef.current) {
        inactiveRef.current = false;
        debugLog("event.activity-reconnect");
        connect("reconnect", "activity-after-inactive");
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
  }, [clearInactivityTimer, clearRetryTimer, connect, debugLog, setPhaseSafe, startInactivityTimer, token]);

  const retryNow = useCallback(() => {
    inactiveRef.current = false;
    retryAttemptRef.current = 0;
    debugLog("retry.manual");
    connect("reconnect", "manual-retry");
  }, [connect]);

  return useMemo(
    () => ({ phase, lastError, hasConnectedOnce, retryNow }),
    [hasConnectedOnce, lastError, phase, retryNow],
  );
}
