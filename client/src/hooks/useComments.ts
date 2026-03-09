import { useState, useEffect } from "react";
import { Timestamp } from "spacetimedb";
import { getConnection } from "../spacetime/connection";

export interface CommentRow {
  id: bigint;
  logId: bigint;
  author: string;
  body: string;
  timestamp: Timestamp;
}

type InsertCb = (ctx: unknown, row: CommentRow) => void;
type DeleteCb = (ctx: unknown, row: CommentRow) => void;

interface CommentTable {
  [Symbol.iterator](): Iterator<CommentRow>;
  onInsert(cb: InsertCb): void;
  onDelete(cb: DeleteCb): void;
  removeOnInsert(cb: InsertCb): void;
  removeOnDelete(cb: DeleteCb): void;
}

export function useComments() {
  const [comments, setComments] = useState<CommentRow[]>([]);

  useEffect(() => {
    const conn = getConnection();
    const table = conn.db.comment as CommentTable;

    setComments([...table]);

    const onInsert: InsertCb = (_ctx, row) =>
      setComments((prev) => [...prev, row]);

    const onDelete: DeleteCb = (_ctx, row) =>
      setComments((prev) => prev.filter((c) => c.id !== row.id));

    table.onInsert(onInsert);
    table.onDelete(onDelete);

    return () => {
      table.removeOnInsert(onInsert);
      table.removeOnDelete(onDelete);
    };
  }, []);

  function commentsFor(logId: bigint) {
    return comments
      .filter((c) => c.logId === logId)
      .sort((a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime());
  }

  return { commentsFor };
}
