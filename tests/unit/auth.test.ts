import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/headers", () => {
  const store = new Map<string, { value: string }>();
  return {
    cookies: vi.fn(async () => ({
      set: vi.fn((name: string, value: string, _opts?: unknown) => {
        store.set(name, { value });
      }),
      get: vi.fn((name: string) => store.get(name) ?? undefined),
      delete: vi.fn((name: string) => {
        store.delete(name);
      }),
      _store: store,
    })),
    __store: store,
  };
});

describe("auth - signed sessions", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "b".repeat(64));
    vi.stubEnv("ADMIN_PASSWORD", "admin123");
    vi.stubEnv("USER_PASSWORD", "user123");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("createSession sets signed auth and role cookies", async () => {
    const { createSession } = await import("@/lib/auth");
    const { cookies } = await import("next/headers");
    await createSession(true);
    const cookieStore = await cookies();
    const authCookie = cookieStore.get("authenticated");
    const roleCookie = cookieStore.get("user_role");
    expect(authCookie?.value).toContain(".");
    expect(authCookie?.value.startsWith("true.")).toBe(true);
    expect(roleCookie?.value.startsWith("admin.")).toBe(true);
  });

  it("isAuthenticated returns true for valid signed cookie", async () => {
    const { createSession, isAuthenticated } = await import("@/lib/auth");
    await createSession(false);
    const result = await isAuthenticated();
    expect(result).toBe(true);
  });

  it("isAuthenticated returns false for unsigned 'true' cookie", async () => {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    cookieStore.set("authenticated", "true", {});
    const { isAuthenticated } = await import("@/lib/auth");
    const result = await isAuthenticated();
    expect(result).toBe(false);
  });

  it("isAdmin returns true for signed admin cookie", async () => {
    const { createSession, isAdmin } = await import("@/lib/auth");
    await createSession(true);
    const result = await isAdmin();
    expect(result).toBe(true);
  });

  it("isAdmin returns false for forged admin cookie", async () => {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    cookieStore.set("user_role", "admin", {});
    const { isAdmin } = await import("@/lib/auth");
    const result = await isAdmin();
    expect(result).toBe(false);
  });

  it("validateSessionCookie rejects unsigned values", async () => {
    const { validateSessionCookie } = await import("@/lib/auth");
    expect(await validateSessionCookie("true")).toBe(false);
  });

  it("validateSessionCookie accepts signed values", async () => {
    const { signValue } = await import("@/lib/crypto");
    const { validateSessionCookie } = await import("@/lib/auth");
    const signed = await signValue("true");
    expect(await validateSessionCookie(signed)).toBe(true);
  });
});
