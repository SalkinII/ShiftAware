interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

interface RateLimiterOptions {
  maxAttempts: number;
  windowMs: number;
}

export class RateLimiter {
  private attempts = new Map<string, RateLimitEntry>();
  private maxAttempts: number;
  private windowMs: number;

  constructor(options: RateLimiterOptions) {
    this.maxAttempts = options.maxAttempts;
    this.windowMs = options.windowMs;
  }

  check(ip: string): RateLimitResult {
    const entry = this.attempts.get(ip);
    if (!entry) return { allowed: true };

    if (Date.now() > entry.resetAt) {
      this.attempts.delete(ip);
      return { allowed: true };
    }

    if (entry.count >= this.maxAttempts) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - Date.now()) / 1000);
      return { allowed: false, retryAfterSeconds };
    }

    return { allowed: true };
  }

  recordFailure(ip: string): void {
    const existing = this.attempts.get(ip);
    const now = Date.now();

    if (existing && now <= existing.resetAt) {
      existing.count += 1;
      existing.resetAt = now + this.windowMs;
    } else {
      this.attempts.set(ip, { count: 1, resetAt: now + this.windowMs });
    }
  }

  reset(ip: string): void {
    this.attempts.delete(ip);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.attempts) {
      if (now > entry.resetAt) {
        this.attempts.delete(ip);
      }
    }
  }
}

export const loginRateLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
});
