import { useCallback, useState } from "react";
import { Timestamp } from "spacetimedb";
import { useLiveTable } from "./useLiveTable";

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

  const getTable = useCallback((conn: ReturnType<typeof import("../spacetime/connection").getConnection>) => conn.db.comment as CommentTable, []);

  const onInitialRows = useCallback((rows: CommentRow[]) => {
    setComments(rows);
  }, []);

  const onInsert: InsertCb = useCallback(
    (_ctx, row) => setComments((prev) => [...prev, row]),
    [],
  );

  const onDelete: DeleteCb = useCallback(
    (_ctx, row) => setComments((prev) => prev.filter((c) => c.id !== row.id)),
    [],
  );

  useLiveTable<CommentRow, CommentTable>({
    getTable,
    onInitialRows,
    onInsert,
    onDelete,
  });

  function commentsFor(logId: bigint) {
    return comments
      .filter((c) => c.logId === logId)
      .sort((a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime());
  }

  return { commentsFor };
}
