import { useState, useEffect } from "react";
import { getConnection } from "../spacetime/connection";

export interface ReactionRow {
  id: bigint;
  logId: bigint;
  emoji: string;
  reactedBy: string;
  timestamp: Date;
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
    const conn = getConnection();
    const table = (conn as any).db.reaction as ReactionTable;

    setReactions([...table]);

    const onInsert: InsertCb = (_ctx, row) =>
      setReactions((prev) => [...prev, row]);

    const onDelete: DeleteCb = (_ctx, row) =>
      setReactions((prev) => prev.filter((r) => r.id !== row.id));

    table.onInsert(onInsert);
    table.onDelete(onDelete);

    return () => {
      table.removeOnInsert(onInsert);
      table.removeOnDelete(onDelete);
    };
  }, []);

  function reactionsFor(logId: bigint) {
    return reactions.filter((r) => r.logId === logId);
  }

  return { reactionsFor };
}
