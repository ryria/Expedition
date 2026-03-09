import { useCallback, useState } from "react";
import { Timestamp } from "spacetimedb";
import { useLiveTable } from "./useLiveTable";

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

type InsertCb = (ctx: unknown, row: ActivityEntry) => void;
type UpdateCb = (ctx: unknown, oldRow: ActivityEntry, newRow: ActivityEntry) => void;
type DeleteCb = (ctx: unknown, row: ActivityEntry) => void;

interface ActivityLogTable {
  [Symbol.iterator](): Iterator<ActivityEntry>;
  onInsert(cb: InsertCb): void;
  onUpdate(cb: UpdateCb): void;
  onDelete(cb: DeleteCb): void;
  removeOnInsert(cb: InsertCb): void;
  removeOnUpdate(cb: UpdateCb): void;
  removeOnDelete(cb: DeleteCb): void;
}

export function useActivityLog() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  const getTable = useCallback((conn: ReturnType<typeof import("../spacetime/connection").getConnection>) => conn.db.activity_log as ActivityLogTable, []);

  const onInitialRows = useCallback((rows: ActivityEntry[]) => {
    setEntries(
      rows.sort(
        (a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime()
      )
    );
  }, []);

  const onInsert: InsertCb = useCallback(
    (_ctx, row) =>
      setEntries((prev) =>
        [row, ...prev].sort(
          (a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime()
        )
      ),
    [],
  );

  const onUpdate: UpdateCb = useCallback(
    (_ctx, oldRow, newRow) => setEntries((prev) => prev.map((e) => (e.id === oldRow.id ? newRow : e))),
    [],
  );

  const onDelete: DeleteCb = useCallback(
    (_ctx, row) => setEntries((prev) => prev.filter((e) => e.id !== row.id)),
    [],
  );

  useLiveTable<ActivityEntry, ActivityLogTable>({
    getTable,
    onInitialRows,
    onInsert,
    onUpdate,
    onDelete,
  });

  return { entries };
}
