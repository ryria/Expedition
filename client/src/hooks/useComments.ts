import { useMemo } from "react";
import { Timestamp } from "spacetimedb";
import { useTable } from "spacetimedb/react";
import { tables } from "../spacetime/generated";

export interface CommentRow {
  id: bigint;
  logId: bigint;
  author: string;
  body: string;
  timestamp: Timestamp;
}

export function useComments() {
  const [rows] = useTable(tables.comment);
  const comments = useMemo(() => rows as readonly CommentRow[], [rows]);

  function commentsFor(logId: bigint) {
    return comments
      .filter((c) => c.logId === logId)
      .sort((a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime());
  }

  return { commentsFor };
}
