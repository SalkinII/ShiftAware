import { describe, it, expect } from "vitest";
import {
  timeToX,
  xToTime,
  laneIndexToY,
  yToLaneIndex,
  durationToWidth,
  snapX,
  snapY,
} from "@/components/features/LaneCalendar/utils/coordinates";

describe("coordinates", () => {
  const eventStart = new Date("2026-06-26T00:00:00Z");

  describe("timeToX", () => {
    it("returns 0 for event start", () => {
      expect(timeToX(eventStart, eventStart)).toBe(0);
    });

    it("returns PIXELS_PER_HOUR for 1 hour offset", () => {
      const oneHourLater = new Date("2026-06-26T01:00:00Z");
      expect(timeToX(oneHourLater, eventStart)).toBe(200);
    });

    it("returns correct X for day 2 at 14:00", () => {
      const day2_14 = new Date("2026-06-27T14:00:00Z");
      // (24 + 14) hours * 200 = 7600
      expect(timeToX(day2_14, eventStart)).toBe(7600);
    });
  });

  describe("xToTime", () => {
    it("returns event start for x=0", () => {
      expect(xToTime(0, eventStart).getTime()).toBe(eventStart.getTime());
    });

    it("returns 1 hour later for x=200", () => {
      const result = xToTime(200, eventStart);
      expect(result.getTime()).toBe(new Date("2026-06-26T01:00:00Z").getTime());
    });
  });

  describe("laneIndexToY", () => {
    it("returns 0 for lane 0", () => {
      expect(laneIndexToY(0)).toBe(0);
    });

    it("returns LANE_HEIGHT for lane 1", () => {
      expect(laneIndexToY(1)).toBe(120);
    });
  });

  describe("yToLaneIndex", () => {
    it("returns 0 for y=0", () => {
      expect(yToLaneIndex(0)).toBe(0);
    });

    it("snaps to nearest lane", () => {
      expect(yToLaneIndex(50)).toBe(0);
      expect(yToLaneIndex(80)).toBe(1);
      expect(yToLaneIndex(130)).toBe(1);
    });
  });

  describe("durationToWidth", () => {
    it("converts 60 min to PIXELS_PER_HOUR", () => {
      expect(durationToWidth(60)).toBe(200);
    });

    it("converts 240 min (4h) to 800px", () => {
      expect(durationToWidth(240)).toBe(800);
    });
  });

  describe("snapX", () => {
    it("snaps to nearest 15-min boundary (50px)", () => {
      expect(snapX(0)).toBe(0);
      expect(snapX(24)).toBe(0);
      expect(snapX(26)).toBe(50);
      expect(snapX(75)).toBe(100);
    });
  });

  describe("snapY", () => {
    it("snaps to nearest lane", () => {
      expect(snapY(0)).toBe(0);
      expect(snapY(59)).toBe(0);
      expect(snapY(61)).toBe(120);
    });
  });
});
