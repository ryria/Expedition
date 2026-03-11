import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useActivityLog } from "./useActivityLog";

const { useTableMock } = vi.hoisted(() => ({
  useTableMock: vi.fn(),
}));

vi.mock("spacetimedb/react", () => {
  return {
    useTable: useTableMock,
  };
});

describe("useActivityLog", () => {
  it("filters entries by active expedition", () => {
    useTableMock.mockReturnValueOnce([
      [
        {
          id: 1n,
          expeditionId: 10n,
          memberId: 1n,
          personName: "A",
          activityType: "run",
          distanceKm: 5,
          note: "",
          timestamp: { toDate: () => new Date("2026-03-10T00:00:00Z") },
          aiResponse: "",
        },
        {
          id: 2n,
          expeditionId: 20n,
          memberId: 2n,
          personName: "B",
          activityType: "walk",
          distanceKm: 3,
          note: "",
          timestamp: { toDate: () => new Date("2026-03-10T01:00:00Z") },
          aiResponse: "",
        },
      ],
      true,
    ]);

    const { result } = renderHook(() => useActivityLog(10n));
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]?.id).toBe(1n);
  });

  it("returns expedition entries sorted newest-first", () => {
    useTableMock.mockReturnValueOnce([
      [
        {
          id: 1n,
          expeditionId: 10n,
          memberId: 1n,
          personName: "A",
          activityType: "run",
          distanceKm: 5,
          note: "",
          timestamp: { toDate: () => new Date("2026-03-10T00:00:00Z") },
          aiResponse: "",
        },
        {
          id: 2n,
          expeditionId: 10n,
          memberId: 1n,
          personName: "A",
          activityType: "cycle",
          distanceKm: 12,
          note: "",
          timestamp: { toDate: () => new Date("2026-03-10T02:00:00Z") },
          aiResponse: "",
        },
      ],
      true,
    ]);

    const { result } = renderHook(() => useActivityLog(10n));
    expect(result.current.entries.map((entry) => entry.id)).toEqual([2n, 1n]);
  });

  it("returns entries sorted newest-first", () => {
    useTableMock.mockReturnValueOnce([[], true]);
    const { result } = renderHook(() => useActivityLog());
    expect(result.current.entries).toEqual([]);
  });
});
