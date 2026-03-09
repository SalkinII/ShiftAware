import { cookies } from "next/headers";
import { scryptSync, timingSafeEqual } from "crypto";
import { signValue, verifyValue } from "@/lib/crypto";

const AUTH_COOKIE_NAME = "authenticated";
const ROLE_COOKIE_NAME = "user_role";
const DEFAULT_TTL_SECONDS =
  Number(process.env.SESSION_TIMEOUT_MINUTES ?? "60") * 60;

function verifyHash(input: string, storedHash: string): boolean {
  if (!storedHash.includes(":")) return false;
  const [salt, key] = storedHash.split(":");
  const hashedInput = scryptSync(input, salt, 64).toString("hex");
  if (hashedInput.length !== key.length) return false;
  return timingSafeEqual(Buffer.from(key), Buffer.from(hashedInput));
}

export async function verifyLogin(
  password: string,
): Promise<{ valid: boolean; isAdmin: boolean }> {
  const adminHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  const userHash = process.env.USER_PASSWORD_HASH?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const userPassword = process.env.USER_PASSWORD?.trim();

  const useHashed = !!adminHash;

  if (useHashed) {
    if (verifyHash(password, adminHash)) {
      return { valid: true, isAdmin: true };
    }
    if (userHash && verifyHash(password, userHash)) {
      return { valid: true, isAdmin: false };
    }
    return { valid: false, isAdmin: false };
  }

  if (!adminPassword) {
    throw new Error(
      "Neither ADMIN_PASSWORD_HASH nor ADMIN_PASSWORD is set",
    );
  }

  console.warn(
    "Using plain-text ADMIN_PASSWORD. Set ADMIN_PASSWORD_HASH for production.",
  );

  if (password === adminPassword) {
    return { valid: true, isAdmin: true };
  }

  if (userPassword && password === userPassword) {
    return { valid: true, isAdmin: false };
  }

  return { valid: false, isAdmin: false };
}

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

  cookieStore.set(AUTH_COOKIE_NAME, await signValue("true"), {
    ...baseCookieOptions,
    httpOnly: true,
  });

  cookieStore.set(
    ROLE_COOKIE_NAME,
    await signValue(isAdmin ? "admin" : "user"),
    {
      ...baseCookieOptions,
      httpOnly: false,
    },
  );
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get(AUTH_COOKIE_NAME);
    if (!authCookie?.value) return false;
    return (await verifyValue(authCookie.value)) === "true";
  } catch {
    return false;
  }
}

export async function isAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const roleCookie = cookieStore.get(ROLE_COOKIE_NAME);
    if (!roleCookie?.value) return false;
    return (await verifyValue(roleCookie.value)) === "admin";
  } catch {
    return false;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  cookieStore.delete(ROLE_COOKIE_NAME);
}

export async function validateSessionCookie(value?: string): Promise<boolean> {
  if (!value) return false;
  return (await verifyValue(value)) === "true";
}
