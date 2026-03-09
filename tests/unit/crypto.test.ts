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
    const signed = await signValue("true");
    expect(signed).toContain(".");
    expect(await verifyValue(signed)).toBe("true");
  });

  it("rejects tampered values", async () => {
    const { signValue, verifyValue } = await import("@/lib/crypto");
    const signed = await signValue("user");
    const tampered = "admin" + signed.substring(signed.indexOf("."));
    expect(await verifyValue(tampered)).toBeNull();
  });

  it("rejects values without a separator", async () => {
    const { verifyValue } = await import("@/lib/crypto");
    expect(await verifyValue("noseparator")).toBeNull();
  });

  it("rejects values with invalid signature", async () => {
    const { verifyValue } = await import("@/lib/crypto");
    expect(await verifyValue("true.invalidsignature")).toBeNull();
  });
});

describe("SESSION_SECRET auto-generation", () => {
  it("auto-generates a secret and logs a warning when SESSION_SECRET is not set", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Force fresh module import
    vi.resetModules();
    const { signValue, verifyValue } = await import("@/lib/crypto");
    const signed = await signValue("test");
    expect(await verifyValue(signed)).toBe("test");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("SESSION_SECRET"),
    );
    warnSpy.mockRestore();
  });
});
