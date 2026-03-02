import { describe, it, expect } from "vitest";
import { mergeNodes } from "@/components/features/LaneCalendar/LaneCalendarCanvas";
import type { Node } from "@xyflow/react";

function makeShiftNode(id: string, x: number, y: number, data?: Record<string, unknown>): Node {
  return {
    id: `shift-${id}`,
    type: "shiftBlock",
    position: { x, y },
    data: { shiftId: id, color: "#0ea5e9", ...data },
    style: { width: 800, height: 460 },
  };
}

function makeLaneNode(id: string, y: number): Node {
  return {
    id: `lane-${id}`,
    type: "laneZone",
    position: { x: 0, y },
    data: {},
  };
}

describe("mergeNodes", () => {
  it("returns new shift nodes when no existing shifts", () => {
    const laneNodes = [makeLaneNode("a", 0)];
    const newShifts = [makeShiftNode("s1", 1600, 0)];
    const result = mergeNodes([], laneNodes, newShifts);
    expect(result).toHaveLength(2); // 1 lane + 1 shift
    expect(result[1].position.y).toBe(0);
  });

  it("preserves existing Y during normal refetch (no reorder)", () => {
    const existing = [
      makeLaneNode("a", 0),
      makeShiftNode("s1", 1600, 0),
    ];
    const laneNodes = [makeLaneNode("a", 0)];
    const newShifts = [makeShiftNode("s1", 1600, 0)];
    const result = mergeNodes(existing, laneNodes, newShifts);
    expect(result[1].position.y).toBe(0);
  });

  it("updates Y when forceYUpdate is true (lane reorder)", () => {
    // Existing shift at Y=0 (lane index 0)
    const existing = [
      makeLaneNode("a", 0),
      makeShiftNode("s1", 1600, 0),
    ];
    // After reorder, shift should be at Y=480 (lane index 1)
    const laneNodes = [makeLaneNode("b", 0), makeLaneNode("a", 480)];
    const newShifts = [makeShiftNode("s1", 1600, 480)];
    const result = mergeNodes(existing, laneNodes, newShifts, true);
    expect(result.find((n) => n.id === "shift-s1")!.position.y).toBe(480);
  });

  it("preserves X position even when forceYUpdate is true", () => {
    const existing = [makeShiftNode("s1", 1600, 0)];
    const laneNodes: Node[] = [];
    const newShifts = [makeShiftNode("s1", 1600, 480)];
    const result = mergeNodes(existing, laneNodes, newShifts, true);
    expect(result.find((n) => n.id === "shift-s1")!.position.x).toBe(1600);
  });

  it("updates data and style from new nodes", () => {
    const existing = [makeShiftNode("s1", 1600, 0, { color: "#old" })];
    const newShifts = [makeShiftNode("s1", 1600, 0, { color: "#new" })];
    const result = mergeNodes(existing, [], newShifts);
    expect((result[0].data as any).color).toBe("#new");
  });

  it("removes shifts no longer in newShiftNodes", () => {
    const existing = [makeShiftNode("s1", 1600, 0), makeShiftNode("s2", 2400, 0)];
    const newShifts = [makeShiftNode("s1", 1600, 0)]; // s2 deleted
    const result = mergeNodes(existing, [], newShifts);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("shift-s1");
  });
});
