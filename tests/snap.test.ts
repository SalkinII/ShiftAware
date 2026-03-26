import { describe, it, expect } from "vitest";
import {
  calculateTimeFromPosition,
  roundToInterval,
  snapToShiftEnd,
} from "../lib/utils/snap";

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

describe("calculateTimeFromPosition - enhanced", () => {
  it("calculates time based on pointer X position within day bounds", () => {
    const dayStart = new Date("2026-01-31T00:00:00");
    const dayEnd = new Date("2026-02-01T00:00:00"); // Full 24-hour period

    // Pointer at 50% should give noon
    const result = calculateTimeFromPosition(0.5, dayStart, dayEnd);
    expect(result.getHours()).toBe(12);
  });

  it("does NOT default to 00:00 when dropped", () => {
    const dayStart = new Date("2026-01-31T00:00:00");
    const dayEnd = new Date("2026-02-01T00:00:00"); // Full 24-hour period

    // Pointer at 75% should give ~18:00, not 00:00
    const result = calculateTimeFromPosition(0.75, dayStart, dayEnd);
    expect(result.getHours()).toBeGreaterThan(0);
    expect(result.getHours()).toBe(18);
  });
});

describe("snapToShiftEnd", () => {
  it("snaps to nearest shift end within threshold", () => {
    const dropTime = new Date("2026-01-31T10:20:00");
    const existingShiftEnds = [
      new Date("2026-01-31T10:00:00"),
      new Date("2026-01-31T10:30:00"), // Within 30min threshold
      new Date("2026-01-31T14:00:00"),
    ];

    const result = snapToShiftEnd(dropTime, existingShiftEnds, 30);
    expect(result.snapped).toBe(true);
    expect(result.time.getHours()).toBe(10);
    expect(result.time.getMinutes()).toBe(30);
  });

  it("returns original time when no shift end within threshold", () => {
    const dropTime = new Date("2026-01-31T12:00:00");
    const existingShiftEnds = [
      new Date("2026-01-31T10:00:00"),
      new Date("2026-01-31T14:00:00"),
    ];

    const result = snapToShiftEnd(dropTime, existingShiftEnds, 30);
    expect(result.snapped).toBe(false);
    expect(result.time.getHours()).toBe(12);
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
