import { DbConnection } from "./generated";
import type { SubscriptionHandle } from "./generated";

export interface ExpeditionProcedures {
  requestAiCoaching(args: { logId: bigint }): Promise<unknown>;
  linkStravaAccount?: (args: { code: string; redirectUri: string }) => Promise<unknown>;
  syncMyStravaActivities?: (args?: Record<string, never>) => Promise<unknown>;
  syncAllStravaActivities?: (args?: Record<string, never>) => Promise<unknown>;
}

// VITE_STDB_URI: WebSocket URI for SpacetimeDB Maincloud, e.g. "wss://maincloud.spacetimedb.com"
const STDB_URI = import.meta.env.VITE_STDB_URI as string;
const STDB_DB = "expedition";
const CONNECT_TIMEOUT_MS = 15_000;

let _conn: DbConnection | null = null;
let _pendingConn: DbConnection | null = null;
let _connectAttempt = 0;
let _connectTimeout: ReturnType<typeof setTimeout> | null = null;
let _isReady = false;

function validateStdbUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) {
    throw new Error("Missing VITE_STDB_URI for SpacetimeDB connection");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid VITE_STDB_URI: ${trimmed}`);
  }

  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    throw new Error(
      `VITE_STDB_URI must use ws:// or wss:// (received ${parsed.protocol})`
    );
  }

  return trimmed;
}

function normalizeConnectError(err: unknown): Error {
  const normalized = err instanceof Error ? err : new Error(String(err ?? "Unknown connection error"));

  if (normalized.message === "[object Event]") {
    return new Error("WebSocket connection interrupted by browser lifecycle event.");
  }

  if (normalized.message.includes("Failed to fetch")) {
    return new Error(
      "WebSocket connection failed (Failed to fetch). Check VITE_STDB_URI, network/firewall access to maincloud.spacetimedb.com, and that your browser allows secure WebSocket (wss)."
    );
  }

  return normalized;
}

function isDocumentHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function isTransientBackgroundError(err: Error): boolean {
  return (
    err.message === "WebSocket connection interrupted by browser lifecycle event." ||
    err.message === "[object Event]" ||
    err.message.includes("WebSocket is closed before the connection is established") ||
    err.message.includes("connection timed out")
  );
}

function shouldIgnoreTransientError(err: Error, hadPendingConnection: boolean): boolean {
  return isTransientBackgroundError(err) && (isDocumentHidden() || !hadPendingConnection);
}

export function getConnection(): DbConnection {
  if (!_conn) throw new Error("SpacetimeDB not connected — call initConnection() first");
  return _conn;
}

export function getProcedures(): ExpeditionProcedures {
  return getConnection().procedures as unknown as ExpeditionProcedures;
}

export function isConnectionActive(): boolean {
  return _conn != null || _pendingConn != null;
}

export function isConnectionReady(): boolean {
  return _isReady;
}

function clearConnectTimeout() {
  if (_connectTimeout) {
    clearTimeout(_connectTimeout);
    _connectTimeout = null;
  }
}

export function disconnectConnection() {
  clearConnectTimeout();
  _isReady = false;
  (_pendingConn as { disconnect?: () => void } | null)?.disconnect?.();
  _pendingConn = null;
  (_conn as { disconnect?: () => void } | null)?.disconnect?.();
  _conn = null;
}

export function initConnection(
  onConnected: (conn: DbConnection) => void,
  onError: (err: Error) => void,
  token?: string,
): DbConnection {
  const attempt = ++_connectAttempt;
  disconnectConnection();
  _isReady = false;

  let stdbUri = "";
  try {
    stdbUri = validateStdbUri(STDB_URI);
  } catch (err) {
    const asError = err instanceof Error ? err : new Error(String(err));
    onError(asError);
    throw asError;
  }

  if (!stdbUri) {
    const err = new Error("Missing VITE_STDB_URI for SpacetimeDB connection");
    onError(err);
    throw err;
  }

  const fail = (err: Error) => {
    if (attempt !== _connectAttempt) return;
    clearConnectTimeout();
    onError(err);
  };

  _connectTimeout = setTimeout(() => {
    fail(new Error(`SpacetimeDB connection timed out after ${CONNECT_TIMEOUT_MS}ms`));
  }, CONNECT_TIMEOUT_MS);

  const conn = DbConnection.builder()
    .withUri(stdbUri)
    .withDatabaseName(STDB_DB)
    .withToken(token)
    .onConnect((ctx) => {
      if (attempt !== _connectAttempt) {
        ctx.disconnect();
        return;
      }

      _conn = ctx;
      _pendingConn = ctx;
      _isReady = false;

      const sub: SubscriptionHandle = ctx
        .subscriptionBuilder()
        .onApplied(() => {
          if (attempt !== _connectAttempt) return;
          clearConnectTimeout();
          _isReady = true;
          console.log("[SpacetimeDB] connected and subscribed");
          onConnected(ctx);
        })
        .onError((ctx) => {
          if (attempt !== _connectAttempt) return;
          const err = ctx.event instanceof Error ? ctx.event : new Error("SpacetimeDB subscription failed");
          const normalized = normalizeConnectError(err);
          if (shouldIgnoreTransientError(normalized, _pendingConn != null || _conn != null)) {
            return;
          }
          console.error("[SpacetimeDB] subscription failed:", normalized);
          fail(normalized);
        })
        .subscribe([
          "SELECT * FROM member",
          "SELECT * FROM activity_log",
          "SELECT * FROM reaction",
          "SELECT * FROM comment",
        ]);
      void sub;
    })
    .onDisconnect((_ctx, err) => {
      if (attempt !== _connectAttempt) return;
      const hadPendingConnection = _pendingConn != null || _conn != null;
      _conn = null;
      _pendingConn = null;
      _isReady = false;
      clearConnectTimeout();

      if (err) {
        const normalized = normalizeConnectError(err);
        if (shouldIgnoreTransientError(normalized, hadPendingConnection)) {
          return;
        }
        console.error("[SpacetimeDB] disconnected with error:", normalized);
        onError(normalized);
      }
    })
    .onConnectError((_ctx, err) => {
      if (attempt !== _connectAttempt) return;
      const normalized = normalizeConnectError(err);
      if (shouldIgnoreTransientError(normalized, _pendingConn != null || _conn != null)) {
        return;
      }
      console.error("[SpacetimeDB] connection failed:", normalized);
      fail(normalized);
    })
    .build();

  _pendingConn = conn;
  return conn;
}
