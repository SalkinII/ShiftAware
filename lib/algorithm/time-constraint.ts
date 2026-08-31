// Pure function — no Prisma runtime, safe for client-side use.
export interface TimeConstraintValue {
  availabilityWindows: { arriveAfter: string; leaveBefore: string }[];
  dailyBlackouts: { date: string; startHour: number; endHour: number }[];
}

export function evaluateTimeConstraint(
  value: TimeConstraintValue,
  shiftStart: Date,
  shiftEnd: Date,
): { ok: true } | { ok: false; reason: "outside_availability" | "blackout_window" } {
  if (value.availabilityWindows.length > 0) {
    const fits = value.availabilityWindows.some(
      (w) => shiftStart >= new Date(w.arriveAfter) && shiftEnd <= new Date(w.leaveBefore),
    );
    if (!fits) return { ok: false, reason: "outside_availability" };
  }

  for (const b of value.dailyBlackouts) {
    const dayStart = new Date(`${b.date}T00:00:00Z`);
    const blackoutStart = new Date(dayStart.getTime() + b.startHour * 3600_000);
    const wrapsMidnight = b.endHour <= b.startHour;
    const blackoutEnd = new Date(
      dayStart.getTime() + (wrapsMidnight ? b.endHour + 24 : b.endHour) * 3600_000,
    );
    const overlaps = shiftStart < blackoutEnd && shiftEnd > blackoutStart;
    if (overlaps) return { ok: false, reason: "blackout_window" };
  }

  return { ok: true };
}
