import { useMemo } from "react";
import { Timestamp } from "spacetimedb";
import { useTable } from "spacetimedb/react";
import { tables } from "../spacetime/generated";

export interface ActivityEntry {
  id: bigint;
  memberId: bigint;
  personName: string;
  activityType: string;
  distanceKm: number;
  note: string;
  timestamp: Timestamp;
  aiResponse: string;
}

export function useActivityLog() {
  const [rows] = useTable(tables.activity_log);
  const entries = useMemo(
    () =>
      [...(rows as readonly ActivityEntry[])].sort(
        (a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime(),
      ),
    [rows],
  );

  return { entries };
}
