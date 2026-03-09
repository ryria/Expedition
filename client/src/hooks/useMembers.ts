import { useState, useEffect } from "react";
import { Timestamp } from "spacetimedb";
import { getConnection } from "../spacetime/connection";

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

  useEffect(() => {
    let disposed = false;
    let table: MemberTable | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const onInsert: InsertCb = (_ctx, row) =>
      setMembers((prev) => [...prev, row].sort((a, b) => Number(a.id - b.id)));

    const onUpdate: UpdateCb = (_ctx, oldRow, newRow) =>
      setMembers((prev) =>
        prev
          .map((m) => (m.id === oldRow.id ? newRow : m))
          .sort((a, b) => Number(a.id - b.id))
      );

    const onDelete: DeleteCb = (_ctx, row) =>
      setMembers((prev) => prev.filter((m) => m.id !== row.id));

    const attach = () => {
      if (disposed) return;

      let conn;
      try {
        conn = getConnection();
      } catch {
        retryTimer = setTimeout(attach, 250);
        return;
      }

      table = conn.db.member as MemberTable;

      const existing = [...table].sort((a, b) => Number(a.id - b.id));
      setMembers(existing);

      table.onInsert(onInsert);
      table.onUpdate(onUpdate);
      table.onDelete(onDelete);
    };

    attach();

    return () => {
      disposed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      table?.removeOnInsert(onInsert);
      table?.removeOnUpdate(onUpdate);
      table?.removeOnDelete(onDelete);
    };
  }, []);

  return { members };
}
