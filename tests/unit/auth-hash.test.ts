import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scryptSync, randomBytes } from "crypto";

vi.mock("next/headers", () => {
  const store = new Map<string, { value: string }>();
  return {
    cookies: vi.fn(async () => ({
      set: vi.fn((name: string, value: string) => store.set(name, { value })),
      get: vi.fn((name: string) => store.get(name)),
      delete: vi.fn((name: string) => store.delete(name)),
    })),
  };
});

function makeHash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

describe("verifyLogin - hashed passwords", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "e".repeat(64));
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("verifies admin via ADMIN_PASSWORD_HASH", async () => {
    const hash = makeHash("secureAdmin!");
    vi.stubEnv("ADMIN_PASSWORD_HASH", hash);
    vi.stubEnv("ADMIN_PASSWORD", "");
    const { verifyLogin } = await import("@/lib/auth");
    const result = await verifyLogin("secureAdmin!");
    expect(result).toEqual({ valid: true, isAdmin: true });
  });

  it("rejects wrong password against ADMIN_PASSWORD_HASH", async () => {
    const hash = makeHash("secureAdmin!");
    vi.stubEnv("ADMIN_PASSWORD_HASH", hash);
    vi.stubEnv("ADMIN_PASSWORD", "");
    const { verifyLogin } = await import("@/lib/auth");
    const result = await verifyLogin("wrongpassword");
    expect(result).toEqual({ valid: false, isAdmin: false });
  });

  it("verifies user via USER_PASSWORD_HASH", async () => {
    const adminHash = makeHash("admin!");
    const userHash = makeHash("user!");
    vi.stubEnv("ADMIN_PASSWORD_HASH", adminHash);
    vi.stubEnv("USER_PASSWORD_HASH", userHash);
    vi.stubEnv("ADMIN_PASSWORD", "");
    const { verifyLogin } = await import("@/lib/auth");
    const result = await verifyLogin("user!");
    expect(result).toEqual({ valid: true, isAdmin: false });
  });

  it("falls back to plain-text ADMIN_PASSWORD with warning", async () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");
    vi.stubEnv("ADMIN_PASSWORD", "plaintext123");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { verifyLogin } = await import("@/lib/auth");
    const result = await verifyLogin("plaintext123");
    expect(result).toEqual({ valid: true, isAdmin: true });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("plain-text"),
    );
    warnSpy.mockRestore();
  });

  it("throws if neither hash nor plain-text admin password is set", async () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");
    vi.stubEnv("ADMIN_PASSWORD", "");
    const { verifyLogin } = await import("@/lib/auth");
    await expect(verifyLogin("anything")).rejects.toThrow();
  });
});
