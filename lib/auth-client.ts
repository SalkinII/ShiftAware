/**
 * Client-side auth utilities.
 * For checking user role from cookies in client components.
 */

const ROLE_COOKIE_NAME = "user_role";

/**
 * Check if current user has admin role (client-side).
 * Reads from document.cookie.
 */
export function isAdminClient(): boolean {
  if (typeof document === "undefined") return false;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === ROLE_COOKIE_NAME && value === "admin") {
      return true;
    }
  }
  return false;
}
