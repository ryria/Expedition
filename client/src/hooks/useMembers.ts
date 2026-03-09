import { useCallback, useState } from "react";
import { Timestamp } from "spacetimedb";
import { useLiveTable } from "./useLiveTable";

export interface MemberRow {
  id: bigint;
  name: string;
  ownerSub: string;
  colorHex: string;
  createdAt: Timestamp;
}

type InsertCb = (ctx: unknown, row: MemberRow) => void;
type UpdateCb = (ctx: unknown, oldRow: MemberRow, newRow: MemberRow) => void;
type DeleteCb = (ctx: unknown, row: MemberRow) => void;

interface MemberTable {
  [Symbol.iterator](): Iterator<MemberRow>;
  onInsert(cb: InsertCb): void;
  onUpdate(cb: UpdateCb): void;
  onDelete(cb: DeleteCb): void;
  removeOnInsert(cb: InsertCb): void;
  removeOnUpdate(cb: UpdateCb): void;
  removeOnDelete(cb: DeleteCb): void;
}

export function useMembers() {
  const [members, setMembers] = useState<MemberRow[]>([]);

  const getTable = useCallback((conn: ReturnType<typeof import("../spacetime/connection").getConnection>) => conn.db.member as MemberTable, []);

  const onInitialRows = useCallback((rows: MemberRow[]) => {
    setMembers(rows.sort((a, b) => Number(a.id - b.id)));
  }, []);

  const onInsert: InsertCb = useCallback(
    (_ctx, row) => setMembers((prev) => [...prev, row].sort((a, b) => Number(a.id - b.id))),
    [],
  );

  const onUpdate: UpdateCb = useCallback(
    (_ctx, oldRow, newRow) =>
      setMembers((prev) =>
        prev
          .map((m) => (m.id === oldRow.id ? newRow : m))
          .sort((a, b) => Number(a.id - b.id))
      ),
    [],
  );

  const onDelete: DeleteCb = useCallback(
    (_ctx, row) => setMembers((prev) => prev.filter((m) => m.id !== row.id)),
    [],
  );

  useLiveTable<MemberRow, MemberTable>({
    getTable,
    onInitialRows,
    onInsert,
    onUpdate,
    onDelete,
  });

  return { members };
}
