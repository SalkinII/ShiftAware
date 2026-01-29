import { describe, it, expect } from "vitest";
import { calculateTimeFromPosition, roundToInterval } from "../lib/utils/snap";

describe("calculateTimeFromPosition", () => {
  it("should calculate time from relative x position", () => {
    const dayStart = new Date("2026-07-15T00:00:00");
    const dayEnd = new Date("2026-07-16T00:00:00");

    // 50% across = noon
    const result = calculateTimeFromPosition(0.5, dayStart, dayEnd);

    expect(result.getHours()).toBe(12);
    expect(result.getMinutes()).toBe(0);
  });

  it("should handle edge positions", () => {
    const dayStart = new Date("2026-07-15T00:00:00");
    const dayEnd = new Date("2026-07-16T00:00:00");

    expect(calculateTimeFromPosition(0, dayStart, dayEnd)).toEqual(dayStart);
    expect(calculateTimeFromPosition(1, dayStart, dayEnd)).toEqual(dayEnd);
  });
});

describe("roundToInterval", () => {
  it("should round to 15-minute intervals", () => {
    const time = new Date("2026-07-15T08:07:00");
    const rounded = roundToInterval(time, 15);

    expect(rounded.getHours()).toBe(8);
    expect(rounded.getMinutes()).toBe(0);
  });

  it("should round up when closer to next interval", () => {
    const time = new Date("2026-07-15T08:08:00");
    const rounded = roundToInterval(time, 15);

    expect(rounded.getHours()).toBe(8);
    expect(rounded.getMinutes()).toBe(15);
  });
});
