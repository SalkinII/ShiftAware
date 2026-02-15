import { describe, it, expect } from "vitest";
import { buildShiftNodes } from "@/components/features/LaneCalendar/hooks/useShiftNodes";
import { type LaneConfig } from "@/lib/types/lane";

describe("buildShiftNodes", () => {
  const eventStart = new Date("2026-06-26T00:00:00Z");
  const lanes: LaneConfig[] = [
    { type: "MOBILE_TEAM", label: "Mobile Team", color: "#0ea5e9", order: 1 },
    { type: "STATIONARY", label: "Stationary", color: "#22c55e", order: 3 },
  ];

  const shifts = [
    {
      id: "shift-1",
      type: "MOBILE_TEAM",
      startTime: "2026-06-26T08:00:00Z",
      endTime: "2026-06-26T12:00:00Z",
      durationMinutes: 240,
      capacity: 4,
      assignments: [{ id: "a1" }, { id: "a2" }],
      _count: { assignments: 2, preferences: 3 },
      event: { id: "e1", name: "Fest" },
      requiredRoles: [],
      templateId: null,
    },
  ];

  it("creates a node at correct X position (8h * 200 = 1600)", () => {
    const nodes = buildShiftNodes(shifts as any, lanes, eventStart);
    expect(nodes[0].position.x).toBe(1600);
  });

  it("creates a node at correct Y position (lane 0 = 0)", () => {
    const nodes = buildShiftNodes(shifts as any, lanes, eventStart);
    expect(nodes[0].position.y).toBe(0);
  });

  it("sets width based on duration (240min = 800px)", () => {
    const nodes = buildShiftNodes(shifts as any, lanes, eventStart);
    expect((nodes[0].data as any).width).toBe(800);
  });

  it("sets node type to shiftBlock", () => {
    const nodes = buildShiftNodes(shifts as any, lanes, eventStart);
    expect(nodes[0].type).toBe("shiftBlock");
  });

  it("sets assignmentCount from assignments array length", () => {
    const nodes = buildShiftNodes(shifts as any, lanes, eventStart);
    expect((nodes[0].data as any).assignmentCount).toBe(2);
  });

  it("skips shifts with unknown lane type", () => {
    const unknownShifts = [{ ...shifts[0], type: "UNKNOWN_LANE" }];
    const nodes = buildShiftNodes(unknownShifts as any, lanes, eventStart);
    expect(nodes).toHaveLength(0);
  });
});
