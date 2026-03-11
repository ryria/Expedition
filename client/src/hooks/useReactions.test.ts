import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useReactions } from "./useReactions";

const { useTableMock } = vi.hoisted(() => ({
  useTableMock: vi.fn(),
}));

vi.mock("spacetimedb/react", () => {
  return {
    useTable: useTableMock,
  };
});

describe("useReactions", () => {
  it("returns only reactions from active expedition", () => {
    useTableMock.mockReturnValueOnce([
      [
        {
          id: 1n,
          expeditionId: 10n,
          logId: 100n,
          emoji: "🔥",
          reactedBy: "A",
          timestamp: { toDate: () => new Date("2026-03-10T00:00:00Z") },
        },
        {
          id: 2n,
          expeditionId: 20n,
          logId: 100n,
          emoji: "🎉",
          reactedBy: "B",
          timestamp: { toDate: () => new Date("2026-03-10T00:01:00Z") },
        },
      ],
      true,
    ]);

    const { result } = renderHook(() => useReactions(10n));
    expect(result.current.reactionsFor(100n).map((reaction) => reaction.id)).toEqual([1n]);
  });

  it("blocks cross-expedition reactions even when log id matches", () => {
    useTableMock.mockReturnValueOnce([
      [
        {
          id: 10n,
          expeditionId: 10n,
          logId: 700n,
          emoji: "🔥",
          reactedBy: "Owner",
          timestamp: { toDate: () => new Date("2026-03-10T00:00:00Z") },
        },
        {
          id: 11n,
          expeditionId: 20n,
          logId: 700n,
          emoji: "💣",
          reactedBy: "Intruder",
          timestamp: { toDate: () => new Date("2026-03-10T00:01:00Z") },
        },
      ],
      true,
    ]);

    const { result } = renderHook(() => useReactions(10n));
    expect(result.current.reactionsFor(700n).map((reaction) => reaction.id)).toEqual([10n]);
  });

  it("preserves legacy behavior when no active expedition is selected", () => {
    useTableMock.mockReturnValueOnce([
      [
        {
          id: 1n,
          expeditionId: 10n,
          logId: 100n,
          emoji: "🔥",
          reactedBy: "A",
          timestamp: { toDate: () => new Date("2026-03-10T00:00:00Z") },
        },
        {
          id: 2n,
          expeditionId: 20n,
          logId: 100n,
          emoji: "🎉",
          reactedBy: "B",
          timestamp: { toDate: () => new Date("2026-03-10T00:01:00Z") },
        },
      ],
      true,
    ]);

    const { result } = renderHook(() => useReactions());
    expect(result.current.reactionsFor(100n).map((reaction) => reaction.id)).toEqual([1n, 2n]);
  });
});
