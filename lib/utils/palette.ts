/**
 * 12-colour palette for template-based lanes.
 * Cycles when there are more templates than colours.
 */
export const LANE_PALETTE = [
  "#0ea5e9", // sky-500
  "#22c55e", // green-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
  "#f97316", // orange-500
  "#6366f1", // indigo-500
  "#14b8a6", // teal-500
  "#a855f7", // purple-500
];

export function getPaletteColor(index: number): string {
  return LANE_PALETTE[index % LANE_PALETTE.length];
}
