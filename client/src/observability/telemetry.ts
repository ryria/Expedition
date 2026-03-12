const SESSION_TRACE_KEY = "expedition-observability-trace-id";

export const OBS_EVENT_NAME = "expedition_observability_event";

export type ErrorFamily = "authz" | "validation" | "sync" | "dependency" | "unknown";
export type ErrorSeverity = "p0" | "p1" | "p2";

export interface ObservabilitySignal {
  component: string;
  event: string;
  errorCode: string;
  severity: ErrorSeverity;
  message: string;
  traceId?: string;
  expeditionId?: string;
  metadata?: Record<string, unknown>;
}

function safeStorageGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {}
}

export function getSessionTraceId(): string {
  const existing = safeStorageGet(SESSION_TRACE_KEY);
  if (existing && existing.trim().length > 0) return existing;

  const created =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  safeStorageSet(SESSION_TRACE_KEY, created);
  return created;
}

export function classifyErrorMessage(message: string): ErrorFamily {
  const text = message.toLowerCase();
  if (text.includes("forbidden") || text.includes("unauthorized") || text.includes("authentication")) {
    return "authz";
  }
  if (
    text.includes("invalid") ||
    text.includes("cannot be empty") ||
    text.includes("out of range") ||
    text.includes("required")
  ) {
    return "validation";
  }
  if (text.includes("sync") || text.includes("timeout") || text.includes("subscription")) {
    return "sync";
  }
  if (
    text.includes("failed to fetch") ||
    text.includes("network") ||
    text.includes("stripe") ||
    text.includes("strava") ||
    text.includes("websocket")
  ) {
    return "dependency";
  }
  return "unknown";
}

export function emitObservabilitySignal(signal: ObservabilitySignal) {
  const traceId = signal.traceId ?? getSessionTraceId();
  const detail = {
    ...signal,
    traceId,
    family: classifyErrorMessage(signal.message),
    timestamp: new Date().toISOString(),
  };

  window.dispatchEvent(new CustomEvent(OBS_EVENT_NAME, { detail }));
}

export function logStructuredClient(signal: ObservabilitySignal) {
  const traceId = signal.traceId ?? getSessionTraceId();
  const entry = {
    level: signal.severity === "p0" ? "error" : signal.severity === "p1" ? "warn" : "info",
    component: signal.component,
    expedition_id: signal.expeditionId ?? "0",
    trace_id: traceId,
    event: signal.event,
    error_code: signal.errorCode,
    timestamp: new Date().toISOString(),
    message: signal.message.slice(0, 240),
    ...signal.metadata,
  };

  if (entry.level === "error") {
    console.error("[Observability]", entry);
  } else if (entry.level === "warn") {
    console.warn("[Observability]", entry);
  } else {
    console.info("[Observability]", entry);
  }
}
