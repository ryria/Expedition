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
  const reactionsByLogId = useMemo(
    () =>
      (rows as readonly ReactionRow[])
        .filter((row) =>
          activeExpeditionId == null ? true : row.expeditionId === activeExpeditionId,
        )
        .reduce((acc, reaction) => {
          const key = reaction.logId.toString();
          const current = acc.get(key) ?? [];
          current.push(reaction);
          acc.set(key, current);
          return acc;
        }, new Map<string, ReactionRow[]>()),
    [rows, activeExpeditionId],
  );

  const sortedReactionsByLogId = useMemo(() => {
    const sorted = new Map<string, ReactionRow[]>();
    for (const [key, reactions] of reactionsByLogId.entries()) {
      sorted.set(
        key,
        [...reactions].sort((a, b) => {
          const delta = a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime();
          if (delta !== 0) return delta;
          if (a.id === b.id) return 0;
          return a.id < b.id ? -1 : 1;
        }),
      );
    }
    return sorted;
  }, [reactionsByLogId]);

  function reactionsFor(logId: bigint) {
    return sortedReactionsByLogId.get(logId.toString()) ?? [];
  }

  return { reactionsFor };
}
