import { useState, useEffect } from "react";
import { Timestamp } from "spacetimedb";
import { getConnection } from "../spacetime/connection";

export interface MemberRow {
  id: bigint;
  name: string;
  colorHex: string;
  createdAt: Timestamp;
}

type InsertCb = (ctx: unknown, row: MemberRow) => void;
type DeleteCb = (ctx: unknown, row: MemberRow) => void;

interface MemberTable {
  [Symbol.iterator](): Iterator<MemberRow>;
  onInsert(cb: InsertCb): void;
  onDelete(cb: DeleteCb): void;
  removeOnInsert(cb: InsertCb): void;
  removeOnDelete(cb: DeleteCb): void;
}

export function useMembers() {
  const [members, setMembers] = useState<MemberRow[]>([]);

  useEffect(() => {
    const conn = getConnection();
    const table = conn.db.member as MemberTable;

    // Load rows already in local cache from subscription
    const existing = [...table].sort((a, b) => Number(a.id - b.id));
    setMembers(existing);

    const onInsert: InsertCb = (_ctx, row) =>
      setMembers((prev) => [...prev, row].sort((a, b) => Number(a.id - b.id)));

    const onDelete: DeleteCb = (_ctx, row) =>
      setMembers((prev) => prev.filter((m) => m.id !== row.id));

    table.onInsert(onInsert);
    table.onDelete(onDelete);

    return () => {
      table.removeOnInsert(onInsert);
      table.removeOnDelete(onDelete);
    };
  }, []);

  return { members };
}
