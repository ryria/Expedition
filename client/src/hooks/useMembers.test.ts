import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMembers } from "./useMembers";

// Mock the SpacetimeDB connection — useMembers calls getConnection() internally
vi.mock("../spacetime/connection", () => {
  const mockMember = {
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
      db: { member: mockMember },
    })),
  };
});

describe("useMembers", () => {
  it("returns empty array initially", () => {
    const { result } = renderHook(() => useMembers());
    expect(result.current.members).toEqual([]);
  });
});
