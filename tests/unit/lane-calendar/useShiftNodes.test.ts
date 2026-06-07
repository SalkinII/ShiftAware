import { describe, it, expect } from "vitest";
import { buildShiftNodes } from "@/components/features/LaneCalendar/hooks/useShiftNodes";
import { type LaneConfig } from "@/lib/types/lane";

describe("buildShiftNodes", () => {
  const eventStart = new Date("2026-06-26T00:00:00Z");
  const lanes: LaneConfig[] = [
    {
      id: "tpl-1",
      templateId: "tpl-1",
      label: "Mobile Team",
      color: "#0ea5e9",
      order: 1,
      type: "MOBILE_TEAM",
    },
    {
      id: "unassigned",
      templateId: null,
      label: "Unassigned",
      color: "#6b7280",
      order: 999,
      type: "MOBILE_TEAM",
    },
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
      templateId: "tpl-1",
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
    expect((nodes[0].style as any).width).toBe(800);
  });

  it("sets node type to shiftBlock", () => {
    const nodes = buildShiftNodes(shifts as any, lanes, eventStart);
    expect(nodes[0].type).toBe("shiftBlock");
  });

  it("sets minimal data (shiftId, color)", () => {
    const nodes = buildShiftNodes(shifts as any, lanes, eventStart);
    const data = nodes[0].data as any;
    expect(data.shiftId).toBe("shift-1");
    expect(data.color).toBe("#0ea5e9");
  });

  it("puts shifts with templateId=null in Unassigned lane", () => {
    const unassignedShifts = [{ ...shifts[0], id: "s2", templateId: null }];
    const nodes = buildShiftNodes(unassignedShifts as any, lanes, eventStart);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].position.y).toBe(480); // lane 1 (Unassigned)
  });

  it("sets userPreference to WANT when preferences map has a WANT entry for the shift", () => {
    const preferences = new Map([["shift-1", "WANT" as const]]);
    const nodes = buildShiftNodes(shifts as any, lanes, eventStart, { preferences });
    expect((nodes[0].data as any).userPreference).toBe("WANT");
  });

  it("sets userPreference to DONT_WANT when preferences map has a DONT_WANT entry", () => {
    const preferences = new Map([["shift-1", "DONT_WANT" as const]]);
    const nodes = buildShiftNodes(shifts as any, lanes, eventStart, { preferences });
    expect((nodes[0].data as any).userPreference).toBe("DONT_WANT");
  });

  it("sets userPreference to null when shift not in preferences map", () => {
    const nodes = buildShiftNodes(shifts as any, lanes, eventStart, { preferences: new Map() });
    expect((nodes[0].data as any).userPreference).toBeNull();
  });
});

describe("buildShiftNodes with reordered lanes", () => {
  const eventStart = new Date("2026-06-26T00:00:00Z");

  const laneA: LaneConfig = {
    id: "tpl-a",
    templateId: "tpl-a",
    label: "Lane A",
    color: "#0ea5e9",
    order: 0,
    type: "MOBILE_TEAM",
  };
  const laneB: LaneConfig = {
    id: "tpl-b",
    templateId: "tpl-b",
    label: "Lane B",
    color: "#22c55e",
    order: 1,
    type: "STATIONARY",
  };
  const unassigned: LaneConfig = {
    id: "unassigned",
    templateId: null,
    label: "Unassigned",
    color: "#6b7280",
    order: 999,
    type: "MOBILE_TEAM",
  };

  const shift = {
    id: "shift-1",
    type: "MOBILE_TEAM",
    startTime: "2026-06-26T08:00:00Z",
    endTime: "2026-06-26T12:00:00Z",
    durationMinutes: 240,
    capacity: 4,
    templateId: "tpl-a",
  };

  it("positions shift in lane A at Y=0 with original order [A, B]", () => {
    const nodes = buildShiftNodes(
      [shift] as any,
      [laneA, laneB, unassigned],
      eventStart,
    );
    expect(nodes[0].position.y).toBe(0); // lane index 0 * 480 = 0
  });

  it("positions shift in lane A at Y=480 with reordered [B, A]", () => {
    const reordered = [
      { ...laneB, order: 0 },
      { ...laneA, order: 1 },
      unassigned,
    ];
    const nodes = buildShiftNodes([shift] as any, reordered, eventStart);
    // tpl-a is now at index 1 in the lanes array → Y = 1 * 480 = 480
    expect(nodes[0].position.y).toBe(480);
  });

  it("preserves shift data (templateName, color) from the correct lane after reorder", () => {
    const reordered = [
      { ...laneB, order: 0 },
      { ...laneA, order: 1 },
      unassigned,
    ];
    const nodes = buildShiftNodes([shift] as any, reordered, eventStart);
    expect((nodes[0].data as any).templateName).toBe("Lane A");
    expect((nodes[0].data as any).color).toBe("#0ea5e9");
  });
});
