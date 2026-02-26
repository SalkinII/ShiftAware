export type CacheScope =
  | "shifts"
  | "assignments"
  | "templates"
  | "preferences"
  | "registrations";

/**
 * Dispatch cache invalidation event for event-scoped data.
 * Components listening on `shiftaware:cache-invalidate` will refetch.
 */
export function invalidateEventCache(
  eventId: string,
  ...scopes: CacheScope[]
) {
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
