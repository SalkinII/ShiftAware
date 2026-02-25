// components/features/LaneCalendar/__tests__/coordinate-alignment.test.ts
import { describe, it, expect } from "vitest";
import { timeToX } from "../utils/coordinates";
import { PIXELS_PER_HOUR } from "../utils/constants";

describe("Coordinate System Alignment", () => {
  it("should calculate consistent X positions for same time across zoom levels", () => {
    const eventStart = new Date("2026-06-26T00:00:00");
    const testTime = new Date("2026-06-26T12:00:00"); // 12 hours later

    const x = timeToX(testTime, eventStart);

    // 12 hours * 200 pixels/hour = 2400 pixels
    expect(x).toBe(12 * PIXELS_PER_HOUR);
  });

  it("should position midnight at 0, 24, 48 hour marks", () => {
    const eventStart = new Date("2026-06-26T00:00:00");

    // Day 0: midnight at 00:00 = 0 hours
    const day0Midnight = new Date("2026-06-26T00:00:00");
    expect(timeToX(day0Midnight, eventStart)).toBe(0);

    // Day 1: midnight at 00:00 = 24 hours
    const day1Midnight = new Date("2026-06-27T00:00:00");
    expect(timeToX(day1Midnight, eventStart)).toBe(24 * PIXELS_PER_HOUR);

    // Day 2: midnight at 00:00 = 48 hours
    const day2Midnight = new Date("2026-06-28T00:00:00");
    expect(timeToX(day2Midnight, eventStart)).toBe(48 * PIXELS_PER_HOUR);
  });

  it("should use PIXELS_PER_HOUR constant consistently", () => {
    const eventStart = new Date("2026-06-26T00:00:00");

    // 1 hour later
    const oneHourLater = new Date("2026-06-26T01:00:00");
    expect(timeToX(oneHourLater, eventStart)).toBe(PIXELS_PER_HOUR);

    // 2 hours later
    const twoHoursLater = new Date("2026-06-26T02:00:00");
    expect(timeToX(twoHoursLater, eventStart)).toBe(2 * PIXELS_PER_HOUR);
  });
});
