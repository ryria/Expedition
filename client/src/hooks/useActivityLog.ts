import { useState, useEffect } from "react";
import { getConnection } from "../spacetime/connection";

export interface ActivityEntry {
  id: bigint;
  personName: string;
  activityType: string;
  distanceKm: number;
  note: string;
  timestamp: Date;
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

  useEffect(() => {
    const conn = getConnection();
    const table = (conn as any).db.activity_log as ActivityLogTable;

    const existing = [...table].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    setEntries(existing);

    const onInsert: InsertCb = (_ctx, row) =>
      setEntries((prev) =>
        [row, ...prev].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
      );

    const onUpdate: UpdateCb = (_ctx, oldRow, newRow) =>
      setEntries((prev) => prev.map((e) => (e.id === oldRow.id ? newRow : e)));

    const onDelete: DeleteCb = (_ctx, row) =>
      setEntries((prev) => prev.filter((e) => e.id !== row.id));

    table.onInsert(onInsert);
    table.onUpdate(onUpdate);
    table.onDelete(onDelete);

    return () => {
      table.removeOnInsert(onInsert);
      table.removeOnUpdate(onUpdate);
      table.removeOnDelete(onDelete);
    };
  }, []);

  return { entries };
}
