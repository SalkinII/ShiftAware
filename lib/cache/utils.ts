import { CacheEntry } from "./types";

/**
 * Check if a cache entry is still valid (not expired)
 */
export function isCacheEntryValid(entry: CacheEntry | null): boolean {
  if (!entry) return false;

  if (entry.ttl) {
    const age = Date.now() - entry.timestamp;
    return age < entry.ttl;
  }

  // No TTL means entry never expires
  return true;
}

/**
 * Generate cache key for shifts filtered by event
 */
export function getShiftsCacheKey(eventId?: string): string {
  return eventId ? `shifts:event:${eventId}` : "shifts";
}

/**
 * Generate cache key for assignments filtered by event
 */
export function getAssignmentsCacheKey(eventId?: string): string {
  return eventId ? `assignments:event:${eventId}` : "assignments";
}

/**
 * Check if a cache key matches a pattern (supports wildcard matching)
 */
export function matchesPattern(key: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return key.startsWith(prefix);
  }
  return key === pattern;
}
