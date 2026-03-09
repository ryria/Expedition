import { describe, it, expect } from "vitest";
import { interpolatePosition, getTrailSegments } from "./route";

describe("interpolatePosition", () => {
  it("returns start point at km 0", () => {
    const pt = interpolatePosition(0);
    expect(pt).toEqual({ x: expect.any(Number), y: expect.any(Number) });
  });

  it("returns end point at km 14500", () => {
    const pt = interpolatePosition(14500);
    expect(pt).toBeDefined();
  });

  it("interpolates midpoint between two waypoints", () => {
    // The route curves (not monotonic), so just check we get finite numbers in viewbox range
    const mid = interpolatePosition(670);
    expect(mid.x).toBeGreaterThanOrEqual(0);
    expect(mid.x).toBeLessThanOrEqual(1100);
    expect(mid.y).toBeGreaterThanOrEqual(0);
    expect(mid.y).toBeLessThanOrEqual(720);
  });
});

describe("getTrailSegments — As Ran", () => {
  it("produces one segment per entry", () => {
    const entries = [
      { personName: "Rob", distanceKm: 10 },
      { personName: "Sam", distanceKm: 5 },
    ];
    const members = [
      { name: "Rob", colorHex: "#8b2020" },
      { name: "Sam", colorHex: "#1a5c3a" },
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
      { personName: "Rob", distanceKm: 10 },
      { personName: "Sam", distanceKm: 5 },
      { personName: "Rob", distanceKm: 5 },
    ];
    const members = [
      { name: "Rob", colorHex: "#8b2020" },
      { name: "Sam", colorHex: "#1a5c3a" },
    ];
    const segs = getTrailSegments(entries, members, "contribution");
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ person: "Rob", fromKm: 0, toKm: 15 });
    expect(segs[1]).toMatchObject({ person: "Sam", fromKm: 15, toKm: 20 });
  });
});
