/**
 * Calendar Snap Utilities
 *
 * Functions for snapping shift templates to the end of existing shifts
 * to create seamless succession in the calendar view.
 */

import { differenceInMinutes } from "date-fns";

/**
 * Find all end times for shifts in a specific lane (shift type)
 *
 * @param shifts - Array of shifts with type and endTime
 * @param targetType - The shift type (lane) to filter by
 * @returns Array of Date objects representing shift end times
 */
export function findShiftEndTimes(
  shifts: Array<{ type: string; endTime: string }>,
  targetType: string
): Date[] {
  return shifts
    .filter((shift) => shift.type === targetType)
    .map((shift) => new Date(shift.endTime))
    .filter((date) => !isNaN(date.getTime()));
}

/**
 * Calculate the snapped position for a dropped template
 *
 * When dropping a template near the end of an existing shift in the same lane,
 * snaps to that end time for seamless succession.
 *
 * @param dropTime - The time where the user dropped the template
 * @param shiftEndTimes - Array of existing shift end times in the same lane
 * @param snapThresholdMinutes - How close (in minutes) to trigger snap (default: 30)
 * @returns Object with snapped flag and resulting time
 */
export function calculateSnapPosition(
  dropTime: Date,
  shiftEndTimes: Date[],
  snapThresholdMinutes: number = 30
): { snapped: boolean; time: Date; snapTarget?: Date } {
  if (shiftEndTimes.length === 0) {
    return { snapped: false, time: dropTime };
  }

  // Find the closest end time
  let closestEndTime: Date | null = null;
  let closestDistance = Infinity;

  for (const endTime of shiftEndTimes) {
    const distance = Math.abs(differenceInMinutes(dropTime, endTime));
    if (distance < closestDistance) {
      closestDistance = distance;
      closestEndTime = endTime;
    }
  }

  // Check if within snap threshold
  if (closestEndTime && closestDistance <= snapThresholdMinutes) {
    return {
      snapped: true,
      time: closestEndTime,
      snapTarget: closestEndTime,
    };
  }

  return { snapped: false, time: dropTime };
}

/**
 * Get all snap targets for a given shift type on a specific date
 *
 * @param shifts - All shifts
 * @param shiftType - The type of shift being dropped
 * @param date - The date to filter by (YYYY-MM-DD format)
 * @returns Array of potential snap targets with metadata
 */
export function getSnapTargets(
  shifts: Array<{ type: string; endTime: string; id: string }>,
  shiftType: string,
  date: string
): Array<{ shiftId: string; endTime: Date }> {
  return shifts
    .filter((shift) => {
      if (shift.type !== shiftType) return false;
      const shiftDate = shift.endTime.split("T")[0];
      return shiftDate === date;
    })
    .map((shift) => ({
      shiftId: shift.id,
      endTime: new Date(shift.endTime),
    }))
    .filter((target) => !isNaN(target.endTime.getTime()));
}
