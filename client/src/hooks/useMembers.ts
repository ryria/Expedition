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

interface MembershipRow {
  memberId: bigint;
  expeditionId: bigint;
  status: string;
  leftAt: unknown;
}

export function useMembers(activeExpeditionId?: bigint | null) {
  const [rows] = useTable(tables.member);
  const [membershipRows] = useTable(tables.membership);

  const members = useMemo(
    () => {
      const sorted = [...(rows as readonly MemberRow[])].sort((a, b) => Number(a.id - b.id));
      if (activeExpeditionId == null) {
        return sorted;
      }

      const membershipSet = new Set(
        (membershipRows as readonly MembershipRow[])
          .filter(
            (membership) =>
              membership.expeditionId === activeExpeditionId &&
              membership.leftAt == null &&
              membership.status.toLowerCase() !== "left",
          )
          .map((membership) => membership.memberId.toString()),
      );

      return sorted.filter((member) => membershipSet.has(member.id.toString()));
    },
    [rows, membershipRows, activeExpeditionId],
  );

  return { members };
}
