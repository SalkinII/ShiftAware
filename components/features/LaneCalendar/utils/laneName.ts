/**
 * Abbreviate a lane label for compact display.
 * Multi-word: uppercase initials ("Mobile North" → "MN")
 * Single-word: first 3 characters ("SUPER" → "SUP")
 */
export function abbreviateLaneName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/);
  if (words.length > 1) {
    return words.map((w) => w[0].toUpperCase()).join("");
  }
  return trimmed.slice(0, 3);
}
