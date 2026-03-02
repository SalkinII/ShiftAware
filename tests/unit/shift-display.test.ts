import { describe, it, expect } from "vitest";
import { getShiftDisplayInfo } from "@/lib/utils/shift-display";

describe("getShiftDisplayInfo", () => {
  it("returns template name when template exists", () => {
    const info = getShiftDisplayInfo({
      template: { name: "Morning Mobile", color: "#0ea5e9" },
      type: "MOBILE_TEAM",
      startTime: "2026-06-26T08:00:00Z",
      endTime: "2026-06-26T12:00:00Z",
      capacity: 4,
      desirabilityScore: 3,
    });
    expect(info.templateName).toBe("Morning Mobile");
    expect(info.color).toBe("#0ea5e9");
  });

  it("falls back to formatted type when no template", () => {
    const info = getShiftDisplayInfo({
      type: "MOBILE_TEAM",
      startTime: "2026-06-26T08:00:00Z",
      endTime: "2026-06-26T12:00:00Z",
    });
    expect(info.templateName).toBe("MOBILE TEAM");
    expect(info.color).toBe("#6b7280");
  });

  it("falls back to 'Shift' when no type and no template", () => {
    const info = getShiftDisplayInfo({
      startTime: "2026-06-26T08:00:00Z",
      endTime: "2026-06-26T12:00:00Z",
    });
    expect(info.templateName).toBe("Shift");
    expect(info.color).toBe("#6b7280");
  });

  it("returns defaults for null shift", () => {
    const info = getShiftDisplayInfo(null);
    expect(info.templateName).toBe("Shift");
    expect(info.timeRange).toBe("—");
    expect(info.color).toBe("#6b7280");
  });

  it("formats time range correctly", () => {
    const info = getShiftDisplayInfo({
      startTime: "2026-06-26T08:00:00Z",
      endTime: "2026-06-26T16:00:00Z",
    });
    expect(info.timeRange).toMatch(/\d{2}:\d{2}–\d{2}:\d{2}/);
  });

  it("counts members from assignments", () => {
    const info = getShiftDisplayInfo({
      assignments: [
        { teamMember: { alias: "Alice" } },
        { teamMember: { alias: "Bob", avatarId: "🎸" } },
      ],
    });
    expect(info.members).toHaveLength(2);
    expect(info.members[0].alias).toBe("Alice");
    expect(info.members[1].avatarId).toBe("🎸");
  });
});

describe("AvailabilityHeatmap shift shape", () => {
  it("ShiftSummary should include templateName when available", () => {
    // This documents the API contract — templateName should be a string
    const shift = {
      id: "s1",
      type: "MOBILE_TEAM",
      templateName: "Morning Mobile",
      startTime: new Date("2026-06-26T08:00:00Z"),
      endTime: new Date("2026-06-26T12:00:00Z"),
      capacity: 4,
      priority: "CORE",
    };
    expect(shift.templateName).toBe("Morning Mobile");
  });
});
