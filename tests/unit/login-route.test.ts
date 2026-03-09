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
    })),
  };
});

describe("POST /api/auth/login - rate limiting", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "d".repeat(64));
    vi.stubEnv("ADMIN_PASSWORD", "correctpassword");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 429 after too many failed attempts", async () => {
    const { loginRateLimiter } = await import("@/lib/rate-limit");
    loginRateLimiter.recordFailure("test-ip");
    loginRateLimiter.recordFailure("test-ip");
    loginRateLimiter.recordFailure("test-ip");
    loginRateLimiter.recordFailure("test-ip");
    loginRateLimiter.recordFailure("test-ip");

    const { POST } = await import("@/app/api/auth/login/route");

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "test-ip",
      },
      body: JSON.stringify({ password: "wrongpassword" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.code).toBe("RATE_LIMITED");
    expect(body.retryAfter).toBeGreaterThan(0);

    loginRateLimiter.reset("test-ip");
  });

  it("resets rate limit on successful login", async () => {
    const { loginRateLimiter } = await import("@/lib/rate-limit");
    loginRateLimiter.recordFailure("success-ip");
    loginRateLimiter.recordFailure("success-ip");

    const { POST } = await import("@/app/api/auth/login/route");

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "success-ip",
      },
      body: JSON.stringify({ password: "correctpassword" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const check = loginRateLimiter.check("success-ip");
    expect(check.allowed).toBe(true);
  });
});
