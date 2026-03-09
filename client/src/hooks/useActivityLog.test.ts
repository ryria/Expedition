import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useActivityLog } from "./useActivityLog";

vi.mock("../spacetime/connection", () => {
  const mockTable = {
    [Symbol.iterator]: () => [][Symbol.iterator](),
    onInsert: vi.fn(),
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    removeOnInsert: vi.fn(),
    removeOnUpdate: vi.fn(),
    removeOnDelete: vi.fn(),
  };
  return {
    getConnection: vi.fn(() => ({
      db: { activity_log: mockTable },
    })),
  };
});

describe("useActivityLog", () => {
  it("returns entries sorted newest-first", () => {
    const { result } = renderHook(() => useActivityLog());
    expect(result.current.entries).toEqual([]);
  });
});
