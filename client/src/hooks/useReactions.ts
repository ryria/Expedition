import { useMemo } from "react";
import { Timestamp } from "spacetimedb";
import { useTable } from "spacetimedb/react";
import { tables } from "../spacetime/generated";

export interface ReactionRow {
  id: bigint;
  expeditionId: bigint;
  logId: bigint;
  emoji: string;
  reactedBy: string;
  timestamp: Timestamp;
}

export function useReactions(activeExpeditionId?: bigint | null) {
  const [rows] = useTable(tables.reaction);
  const reactions = useMemo(
    () =>
      (rows as readonly ReactionRow[]).filter((row) =>
        activeExpeditionId == null ? true : row.expeditionId === activeExpeditionId,
      ),
    [rows, activeExpeditionId],
  );

  function reactionsFor(logId: bigint) {
    return reactions.filter((r) => r.logId === logId);
  }

  return { reactionsFor };
}
