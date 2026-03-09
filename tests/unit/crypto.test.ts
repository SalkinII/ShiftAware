import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("signValue / verifyValue", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "a".repeat(64));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signs a value and verifies it", async () => {
    const { signValue, verifyValue } = await import("@/lib/crypto");
    const signed = signValue("true");
    expect(signed).toContain(".");
    expect(verifyValue(signed)).toBe("true");
  });

  it("rejects tampered values", async () => {
    const { signValue, verifyValue } = await import("@/lib/crypto");
    const signed = signValue("user");
    const tampered = "admin" + signed.substring(signed.indexOf("."));
    expect(verifyValue(tampered)).toBeNull();
  });

  it("rejects values without a separator", async () => {
    const { verifyValue } = await import("@/lib/crypto");
    expect(verifyValue("noseparator")).toBeNull();
  });

  it("rejects values with invalid signature", async () => {
    const { verifyValue } = await import("@/lib/crypto");
    expect(verifyValue("true.invalidsignature")).toBeNull();
  });
});

describe("SESSION_SECRET auto-generation", () => {
  it("auto-generates a secret and logs a warning when SESSION_SECRET is not set", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Force fresh module import
    vi.resetModules();
    const { signValue, verifyValue } = await import("@/lib/crypto");
    const signed = signValue("test");
    expect(verifyValue(signed)).toBe("test");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("SESSION_SECRET"),
    );
    warnSpy.mockRestore();
  });
});
