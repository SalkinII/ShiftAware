import { describe, it, expect } from "vitest";
import { buildLaneNodes } from "@/components/features/LaneCalendar/hooks/useLaneNodes";

describe("buildLaneNodes", () => {
  const lanes = [
    {
      id: "tpl-1",
      templateId: "tpl-1",
      label: "Mobile Team",
      color: "#0ea5e9",
      order: 1,
      type: "MOBILE_TEAM",
    },
    {
      id: "tpl-2",
      templateId: "tpl-2",
      label: "Stationary",
      color: "#22c55e",
      order: 3,
      type: "STATIONARY",
    },
  ];

  it("creates one node per lane at correct Y position", () => {
    const nodes = buildLaneNodes(lanes, 14400);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].position.y).toBe(0); // lane 0
    expect(nodes[1].position.y).toBe(480); // lane 1 (LANE_HEIGHT=480)
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
