/**
 * Returns the first word of a lane label for use in the compact
 * LaneLabelPanel. Trims whitespace before splitting.
 */
export function abbreviateLaneName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
}
