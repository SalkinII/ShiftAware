import { cookies } from "next/headers";

/**
 * Simplified authentication per ShiftAware plan:
 * - Plain ADMIN_PASSWORD env variable (no hashing)
 * - Simple authenticated cookie (no signing)
 * - Configurable session timeout (default 60 minutes)
 * - Role-based access with isAdmin cookie
 */

const AUTH_COOKIE_NAME = "authenticated";
const ROLE_COOKIE_NAME = "user_role";
const DEFAULT_TTL_SECONDS =
  Number(process.env.SESSION_TIMEOUT_MINUTES ?? "60") * 60;

/**
 * Verify login password against ADMIN_PASSWORD or USER_PASSWORD env variable.
 * Returns: { valid: true, isAdmin: true } for admin password
 *          { valid: true, isAdmin: false } for user password
 *          { valid: false } for invalid password
 */
export async function verifyLogin(
  password: string,
): Promise<{ valid: boolean; isAdmin: boolean }> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const userPassword = process.env.USER_PASSWORD;

  if (!adminPassword) {
    throw new Error("ADMIN_PASSWORD environment variable is not set");
  }

  // Check admin password first
  if (password === adminPassword) {
    return { valid: true, isAdmin: true };
  }

  // Check user password (falls back to admin password if not set)
  if (userPassword && password === userPassword) {
    return { valid: true, isAdmin: false };
  }

  return { valid: false, isAdmin: false };
}

/**
 * Create authenticated session cookie.
 * Sets simple "authenticated" cookie with httpOnly flag.
 * Sets role cookie (readable by client for UI purposes).
 */
export async function createSession(isAdmin: boolean = false): Promise<void> {
  const cookieStore = await cookies();
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_SECONDS * 1000);

  const baseCookieOptions = {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: DEFAULT_TTL_SECONDS,
    expires: expiresAt,
    path: "/",
  };

  // Auth cookie is httpOnly for security
  cookieStore.set(AUTH_COOKIE_NAME, "true", {
    ...baseCookieOptions,
    httpOnly: true,
  });

  // Role cookie is NOT httpOnly so client JS can read it for UI
  cookieStore.set(ROLE_COOKIE_NAME, isAdmin ? "admin" : "user", {
    ...baseCookieOptions,
    httpOnly: false,
  });
}

/**
 * Check if user is authenticated by verifying authenticated cookie.
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get(AUTH_COOKIE_NAME);
    return authCookie?.value === "true";
  } catch {
    return false;
  }
}

/**
 * Check if current user has admin role.
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const roleCookie = cookieStore.get(ROLE_COOKIE_NAME);
    return roleCookie?.value === "admin";
  } catch {
    return false;
  }
}

/**
 * Destroy authenticated session by deleting cookies.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  cookieStore.delete(ROLE_COOKIE_NAME);
}

/**
 * Validate session cookie value (for middleware compatibility).
 * Per simplified plan: just checks if value is "true".
 */
export function validateSessionCookie(value?: string): boolean {
  return value === "true";
}
