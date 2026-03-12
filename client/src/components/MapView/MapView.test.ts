import { describe, expect, it } from "vitest";
import { completionPercent } from "./MapView";

describe("MapView completionPercent", () => {
  it("returns 0 when route total is zero", () => {
    expect(completionPercent(12, 0)).toBe(0);
  });

  it("returns finite percentage for valid totals", () => {
    expect(completionPercent(25, 100)).toBe(25);
  });

  it("caps completion at 100 percent", () => {
    expect(completionPercent(120, 100)).toBe(100);
  });
});
