import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMembers } from "./useMembers";
import { tables } from "../spacetime/generated";

const { useTableMock } = vi.hoisted(() => ({
  useTableMock: vi.fn(),
}));

vi.mock("spacetimedb/react", () => {
  return {
    useTable: useTableMock,
  };
});

describe("useMembers", () => {
  it("filters members by active expedition membership", () => {
    useTableMock.mockImplementation((table) => {
      if (table === tables.member) {
        return [
          [
            { id: 1n, name: "A", ownerSub: "sub-a", colorHex: "#111111", createdAt: { toDate: () => new Date() } },
            { id: 2n, name: "B", ownerSub: "sub-b", colorHex: "#222222", createdAt: { toDate: () => new Date() } },
          ],
          true,
        ];
      }

      return [
        [
          { memberId: 1n, expeditionId: 10n, status: "active", leftAt: null },
          { memberId: 2n, expeditionId: 20n, status: "active", leftAt: null },
        ],
        true,
      ];
    });

    const { result } = renderHook(() => useMembers(10n));
    expect(result.current.members.map((member) => member.id)).toEqual([1n]);
  });

  it("excludes stale left memberships", () => {
    useTableMock.mockImplementation((table) => {
      if (table === tables.member) {
        return [
          [
            { id: 1n, name: "A", ownerSub: "sub-a", colorHex: "#111111", createdAt: { toDate: () => new Date() } },
          ],
          true,
        ];
      }

      return [
        [
          { memberId: 1n, expeditionId: 10n, status: "left", leftAt: { toDate: () => new Date() } },
        ],
        true,
      ];
    });

    const { result } = renderHook(() => useMembers(10n));
    expect(result.current.members).toEqual([]);
  });

  it("returns empty array initially", () => {
    useTableMock.mockReturnValue([[], true]);
    const { result } = renderHook(() => useMembers());
    expect(result.current.members).toEqual([]);
  });
});
