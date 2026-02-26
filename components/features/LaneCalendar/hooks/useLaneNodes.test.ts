import { describe, it, expect } from "vitest";
import { buildDaySeparatorNodes } from "./useLaneNodes";

describe("buildDaySeparatorNodes", () => {
  it("excludes separators before timeline start (eventStart not at midnight)", () => {
    // eventStart = 2026-07-15T01:00:00Z (1 hour after midnight)
    const eventStart = new Date("2026-07-15T01:00:00Z");
    const eventEnd = new Date("2026-07-16T01:00:00Z");
    const nodes = buildDaySeparatorNodes(eventStart, eventEnd, 480);

    // d=0 separator would be at startOfDay(eventStart) = midnight July 15,
    // which is timeToX(midnight, 01:00) = -200px (before timeline). Must be excluded.
    const negativeXNodes = nodes.filter((n) => (n.position?.x ?? 0) < 0);
    expect(negativeXNodes).toHaveLength(0);
  });

  it("includes separators within timeline range", () => {
    // eventStart at midnight — all separators should be at x >= 0
    const eventStart = new Date("2026-07-15T00:00:00Z");
    const eventEnd = new Date("2026-07-17T00:00:00Z");
    const nodes = buildDaySeparatorNodes(eventStart, eventEnd, 480);

    // All separator x positions should be >= 0
    nodes.forEach((n) => {
      expect(n.position?.x ?? 0).toBeGreaterThanOrEqual(0);
    });
    // Should have at least 2 separators (d=0, d=1, d=2)
    expect(nodes.length).toBeGreaterThanOrEqual(2);
  });
});
