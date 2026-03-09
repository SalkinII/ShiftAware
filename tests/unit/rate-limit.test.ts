import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the threshold", async () => {
    const { RateLimiter } = await import("@/lib/rate-limit");
    const limiter = new RateLimiter({ maxAttempts: 5, windowMs: 900_000 });
    const result = limiter.check("1.2.3.4");
    expect(result.allowed).toBe(true);
  });

  it("blocks after exceeding threshold", async () => {
    const { RateLimiter } = await import("@/lib/rate-limit");
    const limiter = new RateLimiter({ maxAttempts: 3, windowMs: 900_000 });
    limiter.recordFailure("1.2.3.4");
    limiter.recordFailure("1.2.3.4");
    limiter.recordFailure("1.2.3.4");
    const result = limiter.check("1.2.3.4");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets on successful login", async () => {
    const { RateLimiter } = await import("@/lib/rate-limit");
    const limiter = new RateLimiter({ maxAttempts: 3, windowMs: 900_000 });
    limiter.recordFailure("1.2.3.4");
    limiter.recordFailure("1.2.3.4");
    limiter.reset("1.2.3.4");
    const result = limiter.check("1.2.3.4");
    expect(result.allowed).toBe(true);
  });

  it("allows again after window expires", async () => {
    const { RateLimiter } = await import("@/lib/rate-limit");
    const limiter = new RateLimiter({ maxAttempts: 3, windowMs: 900_000 });
    limiter.recordFailure("1.2.3.4");
    limiter.recordFailure("1.2.3.4");
    limiter.recordFailure("1.2.3.4");
    expect(limiter.check("1.2.3.4").allowed).toBe(false);
    vi.advanceTimersByTime(900_001);
    expect(limiter.check("1.2.3.4").allowed).toBe(true);
  });

  it("tracks IPs independently", async () => {
    const { RateLimiter } = await import("@/lib/rate-limit");
    const limiter = new RateLimiter({ maxAttempts: 2, windowMs: 900_000 });
    limiter.recordFailure("1.1.1.1");
    limiter.recordFailure("1.1.1.1");
    expect(limiter.check("1.1.1.1").allowed).toBe(false);
    expect(limiter.check("2.2.2.2").allowed).toBe(true);
  });

  it("cleans up expired entries", async () => {
    const { RateLimiter } = await import("@/lib/rate-limit");
    const limiter = new RateLimiter({ maxAttempts: 2, windowMs: 60_000 });
    limiter.recordFailure("old-ip");
    vi.advanceTimersByTime(60_001);
    limiter.cleanup();
    expect(limiter.check("old-ip").allowed).toBe(true);
  });
});
