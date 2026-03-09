import { useCallback, useState } from "react";
import { Timestamp } from "spacetimedb";
import { useLiveTable } from "./useLiveTable";

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

  const getTable = useCallback((conn: ReturnType<typeof import("../spacetime/connection").getConnection>) => conn.db.reaction as ReactionTable, []);

  const onInitialRows = useCallback((rows: ReactionRow[]) => {
    setReactions(rows);
  }, []);

  const onInsert: InsertCb = useCallback(
    (_ctx, row) => setReactions((prev) => [...prev, row]),
    [],
  );

  const onDelete: DeleteCb = useCallback(
    (_ctx, row) => setReactions((prev) => prev.filter((r) => r.id !== row.id)),
    [],
  );

  useLiveTable<ReactionRow, ReactionTable>({
    getTable,
    onInitialRows,
    onInsert,
    onDelete,
  });

  function reactionsFor(logId: bigint) {
    return reactions.filter((r) => r.logId === logId);
  }

  return { reactionsFor };
}
