import { describe, it, expect } from "vitest";
import { evaluateTimeConstraint, type TimeConstraintValue } from "@/lib/algorithm/time-constraint";

describe("evaluateTimeConstraint", () => {
  it("allows any shift when no constraints are set", () => {
    const value: TimeConstraintValue = { availabilityWindows: [], dailyBlackouts: [] };
    const result = evaluateTimeConstraint(value, new Date("2026-08-01T08:00:00Z"), new Date("2026-08-01T16:00:00Z"));
    expect(result.ok).toBe(true);
  });

  it("blocks a shift outside the single availability window", () => {
    const value: TimeConstraintValue = {
      availabilityWindows: [{ arriveAfter: "2026-08-01T12:00:00Z", leaveBefore: "2026-08-01T20:00:00Z" }],
      dailyBlackouts: [],
    };
    const result = evaluateTimeConstraint(value, new Date("2026-08-01T08:00:00Z"), new Date("2026-08-01T16:00:00Z"));
    expect(result).toEqual({ ok: false, reason: "outside_availability" });
  });

  it("allows a shift fully inside the single availability window", () => {
    const value: TimeConstraintValue = {
      availabilityWindows: [{ arriveAfter: "2026-08-01T06:00:00Z", leaveBefore: "2026-08-01T20:00:00Z" }],
      dailyBlackouts: [],
    };
    const result = evaluateTimeConstraint(value, new Date("2026-08-01T08:00:00Z"), new Date("2026-08-01T16:00:00Z"));
    expect(result.ok).toBe(true);
  });

  it("allows a shift that fits the second of two windows but not the first", () => {
    const value: TimeConstraintValue = {
      availabilityWindows: [
        { arriveAfter: "2026-08-01T00:00:00Z", leaveBefore: "2026-08-01T04:00:00Z" },
        { arriveAfter: "2026-08-02T12:00:00Z", leaveBefore: "2026-08-02T20:00:00Z" },
      ],
      dailyBlackouts: [],
    };
    const result = evaluateTimeConstraint(value, new Date("2026-08-02T13:00:00Z"), new Date("2026-08-02T18:00:00Z"));
    expect(result.ok).toBe(true);
  });

  it("blocks a shift overlapping a same-day blackout", () => {
    const value: TimeConstraintValue = {
      availabilityWindows: [],
      dailyBlackouts: [{ date: "2026-08-01", startHour: 22, endHour: 23 }],
    };
    const result = evaluateTimeConstraint(value, new Date("2026-08-01T21:30:00Z"), new Date("2026-08-01T22:30:00Z"));
    expect(result).toEqual({ ok: false, reason: "blackout_window" });
  });

  it("does not block a shift that ends exactly when a blackout starts", () => {
    const value: TimeConstraintValue = {
      availabilityWindows: [],
      dailyBlackouts: [{ date: "2026-08-01", startHour: 22, endHour: 23 }],
    };
    const result = evaluateTimeConstraint(value, new Date("2026-08-01T20:00:00Z"), new Date("2026-08-01T22:00:00Z"));
    expect(result.ok).toBe(true);
  });

  it("blocks a shift overlapping a midnight-wrapping blackout, starting before midnight", () => {
    const value: TimeConstraintValue = {
      availabilityWindows: [],
      dailyBlackouts: [{ date: "2026-08-01", startHour: 22, endHour: 6 }],
    };
    const result = evaluateTimeConstraint(value, new Date("2026-08-01T23:00:00Z"), new Date("2026-08-02T01:00:00Z"));
    expect(result).toEqual({ ok: false, reason: "blackout_window" });
  });

  it("blocks a shift overlapping a midnight-wrapping blackout, starting after midnight", () => {
    const value: TimeConstraintValue = {
      availabilityWindows: [],
      dailyBlackouts: [{ date: "2026-08-01", startHour: 22, endHour: 6 }],
    };
    const result = evaluateTimeConstraint(value, new Date("2026-08-02T04:00:00Z"), new Date("2026-08-02T05:00:00Z"));
    expect(result).toEqual({ ok: false, reason: "blackout_window" });
  });

  it("checks multiple blackout entries independently", () => {
    const value: TimeConstraintValue = {
      availabilityWindows: [],
      dailyBlackouts: [
        { date: "2026-08-01", startHour: 22, endHour: 23 },
        { date: "2026-08-02", startHour: 10, endHour: 11 },
      ],
    };
    const result = evaluateTimeConstraint(value, new Date("2026-08-02T10:30:00Z"), new Date("2026-08-02T10:45:00Z"));
    expect(result).toEqual({ ok: false, reason: "blackout_window" });
  });
});
