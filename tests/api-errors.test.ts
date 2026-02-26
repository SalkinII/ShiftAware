import { describe, it, expect } from "vitest";
import { shiftSchema } from "../lib/validations/shift";
import { ZodError } from "zod";

describe("API Error Response Integration", () => {
  describe("Shift Validation Schema", () => {
    it("should validate correct shift data", () => {
      const validShift = {
        eventId: "clx1234567890123456789012",
        type: "MOBILE_TEAM",
        startTime: "2026-06-26T10:00:00.000Z",
        endTime: "2026-06-26T16:00:00.000Z",
        durationMinutes: 360,
        priority: "CORE",
        desirabilityScore: 3,
        capacity: 2,
        requiredRoles: [{ role: "TEAM_MEMBER", count: 1 }],
      };

      const result = shiftSchema.safeParse(validShift);
      expect(result.success).toBe(true);
    });

    it("should reject invalid eventId format", () => {
      const invalidShift = {
        eventId: "short", // Too short (< 10 chars)
        type: "MOBILE_TEAM",
        startTime: "2026-06-26T10:00:00.000Z",
        endTime: "2026-06-26T16:00:00.000Z",
        durationMinutes: 360,
        priority: "CORE",
        desirabilityScore: 3,
        capacity: 2,
        requiredRoles: [{ role: "TEAM_MEMBER", count: 1 }],
      };

      const result = shiftSchema.safeParse(invalidShift);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ZodError);
        expect(result.error.errors[0].path).toContain("eventId");
      }
    });

    it("should reject when endTime is before startTime", () => {
      const invalidShift = {
        eventId: "clx1234567890123456789012",
        type: "MOBILE_TEAM",
        startTime: "2026-06-26T16:00:00.000Z",
        endTime: "2026-06-26T10:00:00.000Z", // Before start
        durationMinutes: 360,
        priority: "CORE",
        desirabilityScore: 3,
        capacity: 2,
        requiredRoles: [{ role: "TEAM_MEMBER", count: 1 }],
      };

      const result = shiftSchema.safeParse(invalidShift);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.errors.some((e) =>
            e.message.includes("End time must be after start time"),
          ),
        ).toBe(true);
      }
    });

    it("should reject when duration doesn't match time difference", () => {
      const invalidShift = {
        eventId: "clx1234567890123456789012",
        type: "MOBILE_TEAM",
        startTime: "2026-06-26T10:00:00.000Z",
        endTime: "2026-06-26T16:00:00.000Z", // 6 hours = 360 minutes
        durationMinutes: 180, // Wrong duration
        priority: "CORE",
        desirabilityScore: 3,
        capacity: 2,
        requiredRoles: [{ role: "TEAM_MEMBER", count: 1 }],
      };

      const result = shiftSchema.safeParse(invalidShift);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.errors.some((e) =>
            e.message.includes("Duration must match time difference"),
          ),
        ).toBe(true);
      }
    });

    it("should reject invalid desirabilityScore", () => {
      const invalidShift = {
        eventId: "clx1234567890123456789012",
        type: "MOBILE_TEAM",
        startTime: "2026-06-26T10:00:00.000Z",
        endTime: "2026-06-26T16:00:00.000Z",
        durationMinutes: 360,
        priority: "CORE",
        desirabilityScore: 10, // Invalid: should be 1-5
        capacity: 2,
        requiredRoles: [{ role: "TEAM_MEMBER", count: 1 }],
      };

      const result = shiftSchema.safeParse(invalidShift);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.errors.some((e) => e.path.includes("desirabilityScore")),
        ).toBe(true);
      }
    });

    it("should allow empty requiredRoles array (marker shifts)", () => {
      const markerShift = {
        eventId: "clx1234567890123456789012",
        type: "MOBILE_TEAM",
        startTime: "2026-06-26T10:00:00.000Z",
        endTime: "2026-06-26T16:00:00.000Z",
        durationMinutes: 360,
        priority: "CORE",
        desirabilityScore: 3,
        capacity: 0,
        requiredRoles: [], // Empty array allowed for marker shifts
      };

      const result = shiftSchema.safeParse(markerShift);
      expect(result.success).toBe(true);
    });
  });

  describe("Date Conversion", () => {
    it("should convert datetime-local to ISO correctly", () => {
      // Simulate form input (datetime-local format: "YYYY-MM-DDTHH:mm")
      const datetimeLocal = "2026-06-26T10:00";
      const date = new Date(datetimeLocal);

      // Should be valid date
      expect(isNaN(date.getTime())).toBe(false);

      // Should convert to ISO string
      const isoString = date.toISOString();
      expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("should calculate duration from ISO dates correctly", () => {
      const start = new Date("2026-06-26T10:00:00.000Z");
      const end = new Date("2026-06-26T16:00:00.000Z");

      const duration = Math.round((end.getTime() - start.getTime()) / 60000);

      expect(duration).toBe(360); // 6 hours = 360 minutes
    });

    it("should handle dates spanning midnight", () => {
      const start = new Date("2026-06-26T22:00:00.000Z");
      const end = new Date("2026-06-27T02:00:00.000Z"); // Next day

      const duration = Math.round((end.getTime() - start.getTime()) / 60000);

      expect(duration).toBe(240); // 4 hours
      expect(isNaN(duration)).toBe(false);
    });
  });
});
