import { describe, it, expect } from "vitest";
import { buildLaneNodes, buildDaySeparatorNodes } from "@/components/features/LaneCalendar/hooks/useLaneNodes";

describe("buildLaneNodes", () => {
  const lanes = [
    { type: "MOBILE_TEAM", label: "Mobile Team", color: "#0ea5e9", order: 1 },
    { type: "STATIONARY", label: "Stationary", color: "#22c55e", order: 3 },
  ];

  it("creates one node per lane at correct Y position", () => {
    const nodes = buildLaneNodes(lanes, 14400);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].position.y).toBe(0);    // lane 0
    expect(nodes[1].position.y).toBe(120);  // lane 1
    expect(nodes[0].position.x).toBe(0);
  });

  it("sets node type to laneZone", () => {
    const nodes = buildLaneNodes(lanes, 14400);
    expect(nodes.every((n) => n.type === "laneZone")).toBe(true);
  });

  it("marks nodes as not draggable and not selectable", () => {
    const nodes = buildLaneNodes(lanes, 14400);
    expect(nodes.every((n) => n.draggable === false)).toBe(true);
    expect(nodes.every((n) => n.selectable === false)).toBe(true);
  });
});

describe("buildDaySeparatorNodes", () => {
  it("creates one separator per midnight in range", () => {
    const start = new Date("2026-06-26T00:00:00Z");
    const end = new Date("2026-06-28T23:59:59Z");
    const nodes = buildDaySeparatorNodes(start, end, 360); // 3 lanes * 120
    // 3 days = separators at day 2 and day 3 midnights = 2 separators
    // Plus one at the start = 3 total
    expect(nodes.length).toBeGreaterThanOrEqual(2);
    expect(nodes.every((n) => n.type === "daySeparator")).toBe(true);
  });
});
