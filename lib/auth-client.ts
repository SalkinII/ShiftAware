/**
 * Client-side auth utilities.
 * For checking user role from cookies in client components.
 */

const ROLE_COOKIE_NAME = "user_role";

function extractPayload(signedValue: string): string {
  const dotIndex = signedValue.lastIndexOf(".");
  if (dotIndex === -1) return signedValue;
  return signedValue.substring(0, dotIndex);
}

/**
 * Check if current user has admin role (client-side).
 * Reads from document.cookie.
 */
export function isAdminClient(): boolean {
  if (typeof document === "undefined") return false;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split("=");
    const value = rest.join("=");
    if (name === ROLE_COOKIE_NAME && extractPayload(value) === "admin") {
      return true;
    }
  }
  return false;
}
