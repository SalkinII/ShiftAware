import { describe, it, expect } from "vitest";
import { LANE_CONFIG, getLaneColor, getLaneLabel } from "../lib/types/lane";

describe("LANE_CONFIG", () => {
  it("should have 5 lanes defined", () => {
    expect(Object.keys(LANE_CONFIG)).toHaveLength(5);
  });

  it("should include all shift types", () => {
    expect(LANE_CONFIG.MOBILE_TEAM_1).toBeDefined();
    expect(LANE_CONFIG.MOBILE_TEAM_2).toBeDefined();
    expect(LANE_CONFIG.STATIONARY).toBeDefined();
    expect(LANE_CONFIG.EXECUTIVE).toBeDefined();
    expect(LANE_CONFIG.EXTENDED).toBeDefined();
  });
});

describe("getLaneColor", () => {
  it("should return color for known lane", () => {
    expect(getLaneColor("MOBILE_TEAM_1")).toBe("#0ea5e9");
  });

  it("should return default for unknown lane", () => {
    expect(getLaneColor("UNKNOWN")).toBe("#6b7280");
  });
});

describe("getLaneLabel", () => {
  it("should return friendly label", () => {
    expect(getLaneLabel("MOBILE_TEAM_1")).toBe("Mobile Team 1");
    expect(getLaneLabel("EXTENDED")).toBe("Extended Service");
  });
});
