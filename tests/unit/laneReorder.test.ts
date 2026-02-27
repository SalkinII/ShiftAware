import { UNASSIGNED_LANE_ID } from "@/lib/types/lane";

type LaneConfig = { id: string; order: number };

function applyReorder(
  lanes: LaneConfig[],
  laneId: string,
  direction: "up" | "down",
): Record<string, number> {
  const sortable = lanes.filter((l) => l.id !== UNASSIGNED_LANE_ID);
  const idx = sortable.findIndex((l) => l.id === laneId);
  if (idx === -1) return {};
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sortable.length) return {};
  const next = [...sortable];
  [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
  const override: Record<string, number> = {};
  next.forEach((l, i) => {
    override[l.id] = i;
  });
  return override;
}

describe("lane reorder logic", () => {
  const lanes: LaneConfig[] = [
    { id: "a", order: 0 },
    { id: "b", order: 1 },
    { id: "c", order: 2 },
    { id: UNASSIGNED_LANE_ID, order: 999 },
  ];

  it("moves lane down", () => {
    const result = applyReorder(lanes, "a", "down");
    expect(result["a"]).toBe(1);
    expect(result["b"]).toBe(0);
    expect(result["c"]).toBe(2);
  });

  it("moves lane up", () => {
    const result = applyReorder(lanes, "b", "up");
    expect(result["a"]).toBe(1);
    expect(result["b"]).toBe(0);
    expect(result["c"]).toBe(2);
  });

  it("does not move first lane up", () => {
    const result = applyReorder(lanes, "a", "up");
    expect(result).toEqual({});
  });

  it("does not move last sortable lane down", () => {
    const result = applyReorder(lanes, "c", "down");
    expect(result).toEqual({});
  });

  it("does not reorder UNASSIGNED lane", () => {
    const result = applyReorder(lanes, UNASSIGNED_LANE_ID, "down");
    expect(result).toEqual({});
  });
});
