import { useState, useEffect } from "react";
import { Timestamp } from "spacetimedb";
import { getConnection } from "../spacetime/connection";

export interface ReactionRow {
  id: bigint;
  logId: bigint;
  emoji: string;
  reactedBy: string;
  timestamp: Timestamp;
}

type InsertCb = (ctx: unknown, row: ReactionRow) => void;
type DeleteCb = (ctx: unknown, row: ReactionRow) => void;

interface ReactionTable {
  [Symbol.iterator](): Iterator<ReactionRow>;
  onInsert(cb: InsertCb): void;
  onDelete(cb: DeleteCb): void;
  removeOnInsert(cb: InsertCb): void;
  removeOnDelete(cb: DeleteCb): void;
}

export function useReactions() {
  const [reactions, setReactions] = useState<ReactionRow[]>([]);

  useEffect(() => {
    let disposed = false;
    let table: ReactionTable | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const onInsert: InsertCb = (_ctx, row) =>
      setReactions((prev) => [...prev, row]);

    const onDelete: DeleteCb = (_ctx, row) =>
      setReactions((prev) => prev.filter((r) => r.id !== row.id));

    const attach = () => {
      if (disposed) return;

      let conn;
      try {
        conn = getConnection();
      } catch {
        retryTimer = setTimeout(attach, 250);
        return;
      }

      table = conn.db.reaction as ReactionTable;
      setReactions([...table]);
      table.onInsert(onInsert);
      table.onDelete(onDelete);
    };

    attach();

    return () => {
      disposed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      table?.removeOnInsert(onInsert);
      table?.removeOnDelete(onDelete);
    };
  }, []);

  function reactionsFor(logId: bigint) {
    return reactions.filter((r) => r.logId === logId);
  }

  return { reactionsFor };
}
