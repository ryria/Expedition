import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useComments } from "./useComments";

const { useTableMock } = vi.hoisted(() => ({
  useTableMock: vi.fn(),
}));

vi.mock("spacetimedb/react", () => {
  return {
    useTable: useTableMock,
  };
});

describe("useComments", () => {
  it("returns only comments from active expedition", () => {
    useTableMock.mockReturnValueOnce([
      [
        {
          id: 1n,
          expeditionId: 10n,
          logId: 100n,
          author: "A",
          body: "first",
          timestamp: { toDate: () => new Date("2026-03-10T00:00:00Z") },
        },
        {
          id: 2n,
          expeditionId: 20n,
          logId: 100n,
          author: "B",
          body: "other",
          timestamp: { toDate: () => new Date("2026-03-10T00:01:00Z") },
        },
      ],
      true,
    ]);

    const { result } = renderHook(() => useComments(10n));
    expect(result.current.commentsFor(100n).map((comment) => comment.id)).toEqual([1n]);
  });

  it("blocks cross-expedition comments even when log id matches", () => {
    useTableMock.mockReturnValueOnce([
      [
        {
          id: 10n,
          expeditionId: 10n,
          logId: 500n,
          author: "Owner",
          body: "allowed",
          timestamp: { toDate: () => new Date("2026-03-10T00:00:00Z") },
        },
        {
          id: 11n,
          expeditionId: 20n,
          logId: 500n,
          author: "Intruder",
          body: "blocked",
          timestamp: { toDate: () => new Date("2026-03-10T00:01:00Z") },
        },
      ],
      true,
    ]);

    const { result } = renderHook(() => useComments(10n));
    expect(result.current.commentsFor(500n).map((comment) => comment.id)).toEqual([10n]);
  });

  it("preserves legacy behavior when no active expedition is selected", () => {
    useTableMock.mockReturnValueOnce([
      [
        {
          id: 1n,
          expeditionId: 10n,
          logId: 100n,
          author: "A",
          body: "first",
          timestamp: { toDate: () => new Date("2026-03-10T00:00:00Z") },
        },
        {
          id: 2n,
          expeditionId: 20n,
          logId: 100n,
          author: "B",
          body: "second",
          timestamp: { toDate: () => new Date("2026-03-10T00:01:00Z") },
        },
      ],
      true,
    ]);

    const { result } = renderHook(() => useComments());
    expect(result.current.commentsFor(100n).map((comment) => comment.id)).toEqual([1n, 2n]);
  });

  it("orders same-timestamp comments deterministically by id", () => {
    useTableMock.mockReturnValueOnce([
      [
        {
          id: 3n,
          expeditionId: 10n,
          logId: 900n,
          author: "C",
          body: "third",
          timestamp: { toDate: () => new Date("2026-03-10T00:00:00Z") },
        },
        {
          id: 1n,
          expeditionId: 10n,
          logId: 900n,
          author: "A",
          body: "first",
          timestamp: { toDate: () => new Date("2026-03-10T00:00:00Z") },
        },
        {
          id: 2n,
          expeditionId: 10n,
          logId: 900n,
          author: "B",
          body: "second",
          timestamp: { toDate: () => new Date("2026-03-10T00:00:00Z") },
        },
      ],
      true,
    ]);

    const { result } = renderHook(() => useComments(10n));
    expect(result.current.commentsFor(900n).map((comment) => comment.id)).toEqual([1n, 2n, 3n]);
  });
});
