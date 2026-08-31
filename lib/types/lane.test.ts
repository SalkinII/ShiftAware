import { describe, it, expect } from "vitest";
import { deriveLanesFromTemplates, UNASSIGNED_LANE_ID } from "./lane";

describe("deriveLanesFromTemplates", () => {
  it("labels the bespoke templateId:null lane 'Notes'", () => {
    const lanes = deriveLanesFromTemplates([{ id: "t1", name: "Mobile", type: "MOBILE_TEAM" }]);
    const bespoke = lanes.find((l) => l.id === UNASSIGNED_LANE_ID);
    expect(bespoke?.label).toBe("Notes");
    expect(bespoke?.templateId).toBeNull();
  });
});
