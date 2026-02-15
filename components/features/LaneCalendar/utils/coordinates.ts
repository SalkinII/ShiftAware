import { PIXELS_PER_HOUR, LANE_HEIGHT, SNAP_PIXELS } from "./constants";

/**
 * Convert a Date to an X pixel position relative to event start.
 */
export function timeToX(time: Date, eventStart: Date): number {
  const diffMs = time.getTime() - eventStart.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours * PIXELS_PER_HOUR;
}

/**
 * Convert an X pixel position back to a Date.
 */
export function xToTime(x: number, eventStart: Date): Date {
  const diffMs = (x / PIXELS_PER_HOUR) * 60 * 60 * 1000;
  return new Date(eventStart.getTime() + diffMs);
}

/**
 * Convert lane index to Y pixel position.
 */
export function laneIndexToY(laneIndex: number): number {
  return laneIndex * LANE_HEIGHT;
}

/**
 * Convert Y pixel position to nearest lane index.
 */
export function yToLaneIndex(y: number): number {
  return Math.max(0, Math.round(y / LANE_HEIGHT));
}

/**
 * Convert shift duration (minutes) to node width (pixels).
 */
export function durationToWidth(durationMinutes: number): number {
  return (durationMinutes / 60) * PIXELS_PER_HOUR;
}

/**
 * Convert node width (pixels) to duration (minutes).
 */
export function widthToDuration(width: number): number {
  return (width / PIXELS_PER_HOUR) * 60;
}

/**
 * Snap X position to nearest 15-minute grid (SNAP_PIXELS).
 */
export function snapX(x: number): number {
  return Math.round(x / SNAP_PIXELS) * SNAP_PIXELS;
}

/**
 * Snap Y position to nearest lane row.
 */
export function snapY(y: number): number {
  return Math.round(y / LANE_HEIGHT) * LANE_HEIGHT;
}
