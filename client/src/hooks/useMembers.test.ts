import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMembers } from "./useMembers";

vi.mock("spacetimedb/react", () => {
  return {
    useTable: vi.fn(() => [[], true]),
  };
});

describe("useMembers", () => {
  it("returns empty array initially", () => {
    const { result } = renderHook(() => useMembers());
    expect(result.current.members).toEqual([]);
  });
});
