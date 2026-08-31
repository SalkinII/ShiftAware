import { describe, it, expect, vi } from "vitest";
import { buildMarkerNodes } from "./useMarkerNodes";
import { UNASSIGNED_LANE_ID, type LaneConfig } from "@/lib/types/lane";
import { LANE_HEIGHT } from "../utils/constants";

const lanes: LaneConfig[] = [
  { id: "t1", templateId: "t1", label: "Mobile", color: "#000", order: 0, type: "MOBILE_TEAM" },
  { id: UNASSIGNED_LANE_ID, templateId: null, label: "Notes", color: "#6b7280", order: 999, type: "MOBILE_TEAM" },
];
const eventStart = new Date("2026-08-01T00:00:00Z");

describe("buildMarkerNodes", () => {
  it("places a marker in the bespoke lane at its start time", () => {
    const nodes = buildMarkerNodes(
      [{ id: "m1", text: "Lunch", startTime: "2026-08-01T12:00:00Z", endTime: "2026-08-01T12:30:00Z" }],
      lanes,
      eventStart,
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("marker-m1");
    expect(nodes[0].type).toBe("marker");
    expect(nodes[0].position.y).toBe(lanes.findIndex((l) => l.templateId === null) * LANE_HEIGHT);
  });

  it("wires onResizeEnd into node data so a resize actually reaches the caller's handler", () => {
    const onResizeEnd = vi.fn();
    const nodes = buildMarkerNodes(
      [{ id: "m1", text: "Lunch", startTime: "2026-08-01T12:00:00Z", endTime: "2026-08-01T12:30:00Z" }],
      lanes,
      eventStart,
      { onResizeEnd },
    );
    const data = nodes[0].data as any;
    expect(typeof data.onResizeEnd).toBe("function");
    data.onResizeEnd({}, { width: 200 });
    expect(onResizeEnd).toHaveBeenCalledWith("marker-m1", { width: 200 });
  });

  it("omits onResizeEnd from node data when readOnly", () => {
    const onResizeEnd = vi.fn();
    const nodes = buildMarkerNodes(
      [{ id: "m1", text: "Lunch", startTime: "2026-08-01T12:00:00Z", endTime: "2026-08-01T12:30:00Z" }],
      lanes,
      eventStart,
      { onResizeEnd, readOnly: true },
    );
    expect((nodes[0].data as any).onResizeEnd).toBeUndefined();
  });
});
