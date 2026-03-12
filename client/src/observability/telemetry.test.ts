import { beforeEach, describe, expect, it } from "vitest";
import { classifyErrorMessage, getSessionTraceId } from "./telemetry";

describe("telemetry", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("classifies authz messages", () => {
    expect(classifyErrorMessage("Authentication required")).toBe("authz");
  });

  it("classifies validation messages", () => {
    expect(classifyErrorMessage("invalid payload_json")).toBe("validation");
  });

  it("returns stable session trace id", () => {
    const first = getSessionTraceId();
    const second = getSessionTraceId();
    expect(first).toBeTruthy();
    expect(first).toBe(second);
  });
});
