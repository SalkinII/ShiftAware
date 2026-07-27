export type CacheScope =
  | "shifts"
  | "assignments"
  | "templates"
  | "preferences"
  | "registrations";

/** Generate cache key for shifts filtered by event */
export function getShiftsCacheKey(eventId?: string): string {
  return eventId ? `shifts:event:${eventId}` : "shifts";
}

/**
 * Dispatch cache invalidation event for event-scoped data.
 * Components listening on `shiftaware:cache-invalidate` will refetch.
 */
export function invalidateEventCache(eventId: string, ...scopes: CacheScope[]) {
  const keys: string[] = [];
  for (const scope of scopes) {
    keys.push(scope, `${scope}:*`, `${scope}:event:${eventId}`);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("shiftaware:cache-invalidate", {
        detail: { keys },
      }),
    );
  }
}
