import { describe, it, expect } from "vitest";

/**
 * Isolated pure-function test for the preference-shift join logic.
 * Extracted from the useMemo in calendar/page.tsx lines 417-438.
 */
function buildPreferencesWithShifts(
  preferences: Array<{ shiftId: string; wantLevel?: string }>,
  shifts: Array<{
    id: string;
    type: string;
    template?: { id: string; name: string } | null;
    startTime: string;
    endTime: string;
  }>,
) {
  return preferences
    .filter(
      (p): p is { shiftId: string; wantLevel: "WANT" | "DONT_WANT" } =>
        !!p.wantLevel,
    )
    .map((p) => {
      const shift = shifts.find((s) => s.id === p.shiftId);
      if (!shift) return null;
      return {
        ...p,
        shift: {
          id: shift.id,
          type: shift.type,
          template: shift.template,
          startTime: shift.startTime,
          endTime: shift.endTime,
        },
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

describe("buildPreferencesWithShifts", () => {
  const shifts = [
    {
      id: "s1",
      type: "STATIONARY",
      template: { id: "t1", name: "Front Gate" },
      startTime: "2026-03-01T08:00:00Z",
      endTime: "2026-03-01T14:00:00Z",
    },
    {
      id: "s2",
      type: "MOBILE_TEAM",
      template: null,
      startTime: "2026-03-01T10:00:00Z",
      endTime: "2026-03-01T16:00:00Z",
    },
  ];

  it("should include template data from matching shift", () => {
    const prefs = [{ shiftId: "s1", wantLevel: "WANT" }];
    const result = buildPreferencesWithShifts(prefs, shifts);
    expect(result[0].shift).toHaveProperty("template");
    expect(result[0].shift.template).toEqual({ id: "t1", name: "Front Gate" });
  });

  it("should handle null template gracefully", () => {
    const prefs = [{ shiftId: "s2", wantLevel: "DONT_WANT" }];
    const result = buildPreferencesWithShifts(prefs, shifts);
    expect(result[0].shift.template).toBeNull();
  });
});
