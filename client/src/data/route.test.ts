import { describe, it, expect } from "vitest";
import { interpolatePosition, getTrailSegments } from "./route";

describe("interpolatePosition", () => {
  it("returns start point at km 0", () => {
    const pt = interpolatePosition(0);
    expect(pt).toEqual({ lat: expect.any(Number), lng: expect.any(Number) });
  });

  it("returns end point at km 14500", () => {
    const pt = interpolatePosition(14500);
    expect(pt).toBeDefined();
  });

  it("interpolates midpoint between two waypoints", () => {
    const mid = interpolatePosition(670);
    expect(mid.lat).toBeGreaterThanOrEqual(-50);
    expect(mid.lat).toBeLessThanOrEqual(0);
    expect(mid.lng).toBeGreaterThanOrEqual(110);
    expect(mid.lng).toBeLessThanOrEqual(160);
  });
});

describe("getTrailSegments — As Ran", () => {
  it("produces one segment per entry", () => {
    const entries = [
      { memberId: 1n, personName: "Rob", distanceKm: 10 },
      { memberId: 2n, personName: "Sam", distanceKm: 5 },
    ];
    const members = [
      { id: 1n, name: "Rob", colorHex: "#8b2020" },
      { id: 2n, name: "Sam", colorHex: "#1a5c3a" },
    ];
    const segs = getTrailSegments(entries, members, "asRan");
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ person: "Rob", fromKm: 0, toKm: 10, color: "#8b2020" });
    expect(segs[1]).toMatchObject({ person: "Sam", fromKm: 10, toKm: 15, color: "#1a5c3a" });
  });
});

describe("getTrailSegments — Contribution", () => {
  it("stacks per-person totals", () => {
    const entries = [
      { memberId: 1n, personName: "Rob", distanceKm: 10 },
      { memberId: 2n, personName: "Sam", distanceKm: 5 },
      { memberId: 1n, personName: "Rob", distanceKm: 5 },
    ];
    const members = [
      { id: 1n, name: "Rob", colorHex: "#8b2020" },
      { id: 2n, name: "Sam", colorHex: "#1a5c3a" },
    ];
    const segs = getTrailSegments(entries, members, "contribution");
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ person: "Rob", fromKm: 0, toKm: 15 });
    expect(segs[1]).toMatchObject({ person: "Sam", fromKm: 15, toKm: 20 });
  });
});
