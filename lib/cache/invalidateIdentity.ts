/**
 * Invalidate identity-related cache (global, not event-scoped).
 */
export function invalidateIdentity() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("shiftaware:cache-invalidate", {
        detail: { keys: ["identity", "identity:*", "members", "members:*"] },
      }),
    );
  }
}
