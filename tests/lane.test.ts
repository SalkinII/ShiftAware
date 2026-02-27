import { describe, it, expect } from "vitest";
import {
  deriveLanesFromTemplates,
  getLaneColor,
  getLaneLabel,
  UNASSIGNED_LANE_ID,
} from "../lib/types/lane";

describe("deriveLanesFromTemplates", () => {
  it("returns empty when no templates", () => {
    expect(deriveLanesFromTemplates([])).toEqual([]);
  });

  it("creates one lane per template with palette colors", () => {
    const templates = [
      { id: "t1", name: "Mobile North", type: "MOBILE_TEAM" },
      { id: "t2", name: "Stationary", type: "STATIONARY" },
    ];
    const lanes = deriveLanesFromTemplates(templates);
    expect(lanes).toHaveLength(3); // 2 templates + Unassigned
    expect(lanes[0].id).toBe("t1");
    expect(lanes[0].templateId).toBe("t1");
    expect(lanes[0].label).toBe("Mobile North");
    expect(lanes[1].id).toBe("t2");
    expect(lanes[2].id).toBe(UNASSIGNED_LANE_ID);
    expect(lanes[2].templateId).toBeNull();
  });

  it("prefers template.color over palette when set", () => {
    const templates = [
      { id: "t1", name: "Mobile North", type: "MOBILE_TEAM", color: "#ff0000" },
      { id: "t2", name: "Stationary", type: "STATIONARY", color: null },
    ];
    const lanes = deriveLanesFromTemplates(templates);
    expect(lanes[0].color).toBe("#ff0000"); // DB colour
    expect(lanes[1].color).not.toBe("#ff0000"); // Falls back to palette
  });
});

describe("getLaneColor", () => {
  it("should return color for known type", () => {
    expect(getLaneColor("MOBILE_TEAM")).toBe("#0ea5e9");
  });

  it("should return default for unknown type", () => {
    expect(getLaneColor("UNKNOWN")).toBe("#6b7280");
  });
});

describe("getLaneLabel", () => {
  it("should return friendly label", () => {
    expect(getLaneLabel("MOBILE_TEAM")).toBe("Mobile Team");
  });
});
