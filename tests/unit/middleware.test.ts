import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.stubEnv("SESSION_SECRET", "c".repeat(64));

describe("middleware - signed cookie validation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects unsigned 'true' auth cookie", async () => {
    const { validateSessionCookie } = await import("@/lib/auth");
    expect(validateSessionCookie("true")).toBe(false);
  });

  it("accepts signed auth cookie", async () => {
    const { signValue } = await import("@/lib/crypto");
    const { validateSessionCookie } = await import("@/lib/auth");
    const signed = signValue("true");
    expect(validateSessionCookie(signed)).toBe(true);
  });

  it("rejects forged role value", async () => {
    const { signValue, verifyValue } = await import("@/lib/crypto");
    const signedUser = signValue("user");
    const forged = "admin" + signedUser.substring(signedUser.indexOf("."));
    expect(verifyValue(forged)).toBeNull();
  });
});
