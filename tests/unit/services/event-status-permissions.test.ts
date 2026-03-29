import { describe, it, expect } from "vitest";
import { canShowSwapPanel } from "@/lib/services/event-status-permissions";

describe("canShowSwapPanel", () => {
  it("returns true for ASSIGNING", () => {
    expect(canShowSwapPanel("ASSIGNING")).toBe(true);
  });

  it("returns true for FINALIZED", () => {
    expect(canShowSwapPanel("FINALIZED")).toBe(true);
  });

  it("returns false for PLANNING", () => {
    expect(canShowSwapPanel("PLANNING")).toBe(false);
  });

  it("returns false for OPEN_FOR_PREFERENCES", () => {
    expect(canShowSwapPanel("OPEN_FOR_PREFERENCES")).toBe(false);
  });

  it("returns false for COMPLETED", () => {
    expect(canShowSwapPanel("COMPLETED")).toBe(false);
  });
});
