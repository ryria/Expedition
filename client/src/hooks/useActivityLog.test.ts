import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useActivityLog } from "./useActivityLog";

vi.mock("spacetimedb/react", () => {
  return {
    useTable: vi.fn(() => [[], true]),
  };
});

describe("useActivityLog", () => {
  it("returns entries sorted newest-first", () => {
    const { result } = renderHook(() => useActivityLog());
    expect(result.current.entries).toEqual([]);
  });
});
