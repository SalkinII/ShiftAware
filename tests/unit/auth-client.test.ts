import { describe, it, expect, vi, afterEach } from "vitest";

describe("isAdminClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true for signed admin cookie", async () => {
    vi.stubGlobal("document", {
      cookie: "user_role=admin.abc123def456;authenticated=true.xyz",
    });
    const { isAdminClient } = await import("@/lib/auth-client");
    expect(isAdminClient()).toBe(true);
  });

  it("returns false for signed user cookie", async () => {
    vi.stubGlobal("document", {
      cookie: "user_role=user.abc123def456",
    });
    const { isAdminClient } = await import("@/lib/auth-client");
    expect(isAdminClient()).toBe(false);
  });

  it("returns false when no role cookie", async () => {
    vi.stubGlobal("document", { cookie: "" });
    const { isAdminClient } = await import("@/lib/auth-client");
    expect(isAdminClient()).toBe(false);
  });

  it("returns false when document is undefined (SSR)", async () => {
    vi.stubGlobal("document", undefined);
    const { isAdminClient } = await import("@/lib/auth-client");
    expect(isAdminClient()).toBe(false);
  });
});
