import { useMemo } from "react";
import { Timestamp } from "spacetimedb";
import { useTable } from "spacetimedb/react";
import { tables } from "../spacetime/generated";

export interface MemberRow {
  id: bigint;
  name: string;
  ownerSub: string;
  colorHex: string;
  createdAt: Timestamp;
}

export function useMembers() {
  const [rows] = useTable(tables.member);
  const members = useMemo(
    () => [...(rows as readonly MemberRow[])].sort((a, b) => Number(a.id - b.id)),
    [rows],
  );

  return { members };
}
