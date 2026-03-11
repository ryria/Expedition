import { useMemo } from "react";
import { Timestamp } from "spacetimedb";
import { useTable } from "spacetimedb/react";
import { tables } from "../spacetime/generated";

export interface CommentRow {
  id: bigint;
  expeditionId: bigint;
  logId: bigint;
  author: string;
  body: string;
  timestamp: Timestamp;
}

export function useComments(activeExpeditionId?: bigint | null) {
  const [rows] = useTable(tables.comment);
  const comments = useMemo(
    () =>
      (rows as readonly CommentRow[]).filter((row) =>
        activeExpeditionId == null ? true : row.expeditionId === activeExpeditionId,
      ),
    [rows, activeExpeditionId],
  );

  function commentsFor(logId: bigint) {
    return comments
      .filter((c) => c.logId === logId)
      .sort((a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime());
  }

  return { commentsFor };
}
