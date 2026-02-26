import { describe, it, expect } from "vitest";
import { buildLaneNodes } from "./useLaneNodes";

describe("useLaneNodes", () => {
  it("buildLaneNodes creates lane zone nodes", () => {
    const lanes = [
      {
        id: "tpl-1",
        templateId: "tpl-1",
        label: "Mobile",
        color: "#0ea5e9",
        order: 1,
        type: "MOBILE_TEAM",
      },
    ];
    const nodes = buildLaneNodes(lanes, 1000);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("laneZone");
    expect(nodes[0].position?.y).toBe(0);
  });
});
