import { DbConnection } from "./generated";
import type { SubscriptionHandle } from "./generated";

export interface ExpeditionProcedures {
  requestAiCoaching(args: { logId: bigint }): void;
}

// VITE_STDB_URI: WebSocket URI for SpacetimeDB Maincloud, e.g. "wss://maincloud.spacetimedb.com"
const STDB_URI = import.meta.env.VITE_STDB_URI as string;
const STDB_DB = "expedition";

let _conn: DbConnection | null = null;

export function getConnection(): DbConnection {
  if (!_conn) throw new Error("SpacetimeDB not connected — call initConnection() first");
  return _conn;
}

export function getProcedures(): ExpeditionProcedures {
  return getConnection().procedures as ExpeditionProcedures;
}

export function initConnection(
  onConnected: (conn: DbConnection) => void,
  onError: (err: Error) => void,
): DbConnection {
  const conn = DbConnection.builder()
    .withUri(STDB_URI)
    .withDatabaseName(STDB_DB)
    .onConnect((ctx) => {
      _conn = ctx;
      const sub: SubscriptionHandle = ctx
        .subscriptionBuilder()
        .onApplied(() => {
          console.log("[SpacetimeDB] connected and subscribed");
          onConnected(ctx);
        })
        .subscribe([
          "SELECT * FROM member",
          "SELECT * FROM activity_log",
          "SELECT * FROM reaction",
          "SELECT * FROM comment",
        ]);
      void sub;
    })
    .onConnectError((_ctx, err) => {
      console.error("[SpacetimeDB] connection failed:", err);
      onError(err);
    })
    .build();
  return conn;
}
