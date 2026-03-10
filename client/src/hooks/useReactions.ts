import { useMemo } from "react";
import { Timestamp } from "spacetimedb";
import { useTable } from "spacetimedb/react";
import { tables } from "../spacetime/generated";

export interface ReactionRow {
  id: bigint;
  logId: bigint;
  emoji: string;
  reactedBy: string;
  timestamp: Timestamp;
}

export function useReactions() {
  const [rows] = useTable(tables.reaction);
  const reactions = useMemo(() => rows as readonly ReactionRow[], [rows]);

  function reactionsFor(logId: bigint) {
    return reactions.filter((r) => r.logId === logId);
  }

  return { reactionsFor };
}
