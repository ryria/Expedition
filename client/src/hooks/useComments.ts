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
  const commentsByLogId = useMemo(
    () =>
      (rows as readonly CommentRow[])
        .filter((row) =>
          activeExpeditionId == null ? true : row.expeditionId === activeExpeditionId,
        )
        .reduce((acc, comment) => {
          const key = comment.logId.toString();
          const current = acc.get(key) ?? [];
          current.push(comment);
          acc.set(key, current);
          return acc;
        }, new Map<string, CommentRow[]>()),
    [rows, activeExpeditionId],
  );

  const sortedCommentsByLogId = useMemo(() => {
    const sorted = new Map<string, CommentRow[]>();
    for (const [key, comments] of commentsByLogId.entries()) {
      sorted.set(
        key,
        [...comments].sort((a, b) => {
          const delta = a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime();
          if (delta !== 0) return delta;
          if (a.id === b.id) return 0;
          return a.id < b.id ? -1 : 1;
        }),
      );
    }
    return sorted;
  }, [commentsByLogId]);

  function commentsFor(logId: bigint) {
    return sortedCommentsByLogId.get(logId.toString()) ?? [];
  }

  return { commentsFor };
}
