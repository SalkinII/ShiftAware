# Secure Auth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Harden ShiftAware authentication with signed session cookies, login rate limiting, and hashed passwords.

**Architecture:** Three layered improvements to `lib/auth.ts` and its consumers. Cookie signing uses HMAC-SHA256 with a server-side secret. Rate limiting uses an in-memory Map keyed by IP. Password hashing uses scrypt with random salt. All changes are backward-compatible — existing plain-text password setups continue working with logged warnings.

**Tech Stack:** Node.js `crypto` module (createHmac, scryptSync, timingSafeEqual, randomBytes). Vitest for unit tests. No new dependencies.

**Design doc:** `docs/plans/2026-03-09-secure-auth-design.md`

---

### Task 1: Cookie Signing Utility

Build the low-level sign/verify functions that all other auth changes depend on.

**Files:**
- Create: `lib/crypto.ts`
- Test: `tests/unit/crypto.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/crypto.test.ts`:

```typescript
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
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/crypto.test.ts`
Expected: FAIL — module `@/lib/crypto` does not exist.

**Step 3: Implement `lib/crypto.ts`**

Create `lib/crypto.ts`:

```typescript
import { createHmac, randomBytes } from "crypto";

function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 32) {
    return envSecret;
  }
  console.warn(
    "SESSION_SECRET is not set or too short. Auto-generating an ephemeral secret. " +
      "Sessions will not survive server restarts. Set SESSION_SECRET in production.",
  );
  const generated = randomBytes(32).toString("hex");
  process.env.SESSION_SECRET = generated;
  return generated;
}

let cachedSecret: string | null = null;

function getSecret(): string {
  if (!cachedSecret) {
    cachedSecret = getSessionSecret();
  }
  return cachedSecret;
}

export function signValue(payload: string): string {
  const hmac = createHmac("sha256", getSecret());
  hmac.update(payload);
  const signature = hmac.digest("hex");
  return `${payload}.${signature}`;
}

export function verifyValue(signed: string): string | null {
  const dotIndex = signed.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const payload = signed.substring(0, dotIndex);
  const signature = signed.substring(dotIndex + 1);

  const hmac = createHmac("sha256", getSecret());
  hmac.update(payload);
  const expected = hmac.digest("hex");

  if (signature.length !== expected.length) return null;

  let match = true;
  for (let i = 0; i < signature.length; i++) {
    if (signature[i] !== expected[i]) match = false;
  }

  return match ? payload : null;
}

export function _resetCachedSecret(): void {
  cachedSecret = null;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/crypto.test.ts`
Expected: All 5 tests PASS.

**Step 5: Commit**

```
git add lib/crypto.ts tests/unit/crypto.test.ts
git commit -m "feat(auth): add HMAC cookie signing utility"
```

---

### Task 2: Integrate Cookie Signing into `lib/auth.ts`

Replace plain cookie values with signed values. Verification reads payload from signed cookies.

**Files:**
- Modify: `lib/auth.ts` (full rewrite of cookie set/read logic)
- Test: `tests/unit/auth.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/auth.test.ts`:

```typescript
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
    expect(validateSessionCookie("true")).toBe(false);
  });

  it("validateSessionCookie accepts signed values", async () => {
    const { signValue } = await import("@/lib/crypto");
    const { validateSessionCookie } = await import("@/lib/auth");
    const signed = signValue("true");
    expect(validateSessionCookie(signed)).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/auth.test.ts`
Expected: FAIL — current `isAuthenticated` accepts plain `"true"`.

**Step 3: Update `lib/auth.ts`**

Modify `lib/auth.ts` to use `signValue`/`verifyValue` from `lib/crypto.ts`:

- `createSession`: sign cookie values before setting — `signValue("true")` and `signValue(role)`
- `isAuthenticated`: use `verifyValue` on cookie value, check payload equals `"true"`
- `isAdmin`: use `verifyValue` on role cookie, check payload equals `"admin"`
- `validateSessionCookie`: use `verifyValue`, return `payload === "true"`

Full replacement of `lib/auth.ts`:

```typescript
import { cookies } from "next/headers";
import { signValue, verifyValue } from "@/lib/crypto";

const AUTH_COOKIE_NAME = "authenticated";
const ROLE_COOKIE_NAME = "user_role";
const DEFAULT_TTL_SECONDS =
  Number(process.env.SESSION_TIMEOUT_MINUTES ?? "60") * 60;

export async function verifyLogin(
  password: string,
): Promise<{ valid: boolean; isAdmin: boolean }> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const userPassword = process.env.USER_PASSWORD;

  if (!adminPassword) {
    throw new Error("ADMIN_PASSWORD environment variable is not set");
  }

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

  cookieStore.set(AUTH_COOKIE_NAME, signValue("true"), {
    ...baseCookieOptions,
    httpOnly: true,
  });

  cookieStore.set(
    ROLE_COOKIE_NAME,
    signValue(isAdmin ? "admin" : "user"),
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
    return verifyValue(authCookie.value) === "true";
  } catch {
    return false;
  }
}

export async function isAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const roleCookie = cookieStore.get(ROLE_COOKIE_NAME);
    if (!roleCookie?.value) return false;
    return verifyValue(roleCookie.value) === "admin";
  } catch {
    return false;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  cookieStore.delete(ROLE_COOKIE_NAME);
}

export function validateSessionCookie(value?: string): boolean {
  if (!value) return false;
  return verifyValue(value) === "true";
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/auth.test.ts`
Expected: All 7 tests PASS.

**Step 5: Commit**

```
git add lib/auth.ts tests/unit/auth.test.ts
git commit -m "feat(auth): integrate HMAC signing into session cookies"
```

---

### Task 3: Update Middleware for Signed Cookies

The middleware reads cookies directly — it needs to use `verifyValue` instead of string comparison.

**Files:**
- Modify: `middleware.ts:28-29`
- Test: `tests/unit/middleware.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/middleware.test.ts`:

```typescript
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
```

**Step 2: Run tests to verify they fail (or pass — depends on Task 2 state)**

Run: `npx vitest run tests/unit/middleware.test.ts`
Expected: PASS if Task 2 is already implemented. If not, FAIL.

**Step 3: Update `middleware.ts`**

Replace lines 1-5 and 28-29 in `middleware.ts`. Import `verifyValue` and use it for both cookie checks:

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyValue } from "@/lib/crypto";

const AUTH_COOKIE = "authenticated";
const ROLE_COOKIE = "user_role";
```

Replace line 28-29:

```typescript
  const authPayload = verifyValue(request.cookies.get(AUTH_COOKIE)?.value ?? "");
  const authenticated = authPayload === "true";
  const userRole = verifyValue(request.cookies.get(ROLE_COOKIE)?.value ?? "");
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/middleware.test.ts`
Expected: All 3 tests PASS.

Also run existing tests to check nothing broke:

Run: `npx vitest run`
Expected: All existing tests still pass.

**Step 5: Commit**

```
git add middleware.ts tests/unit/middleware.test.ts
git commit -m "feat(auth): middleware validates signed cookies"
```

---

### Task 4: Update Client-Side Role Parsing

`lib/auth-client.ts` reads `user_role` from `document.cookie`. Now the value is `admin.signature` — it needs to extract the payload before the last dot.

**Files:**
- Modify: `lib/auth-client.ts:17-19`
- Test: `tests/unit/auth-client.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/auth-client.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";

describe("isAdminClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true for signed admin cookie", () => {
    vi.stubGlobal("document", {
      cookie: "user_role=admin.abc123def456;authenticated=true.xyz",
    });
    const { isAdminClient } = require("@/lib/auth-client");
    expect(isAdminClient()).toBe(true);
  });

  it("returns false for signed user cookie", () => {
    vi.stubGlobal("document", {
      cookie: "user_role=user.abc123def456",
    });
    const { isAdminClient } = require("@/lib/auth-client");
    expect(isAdminClient()).toBe(false);
  });

  it("returns false when no role cookie", () => {
    vi.stubGlobal("document", { cookie: "" });
    const { isAdminClient } = require("@/lib/auth-client");
    expect(isAdminClient()).toBe(false);
  });

  it("returns false when document is undefined (SSR)", () => {
    const { isAdminClient } = require("@/lib/auth-client");
    // document is undefined in node by default
    vi.stubGlobal("document", undefined);
    expect(isAdminClient()).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/auth-client.test.ts`
Expected: FAIL — current code compares value to `"admin"` but cookie now has `"admin.signature"`.

**Step 3: Update `lib/auth-client.ts`**

Replace the cookie matching logic. Extract payload (part before last dot):

```typescript
const ROLE_COOKIE_NAME = "user_role";

function extractPayload(signedValue: string): string {
  const dotIndex = signedValue.lastIndexOf(".");
  if (dotIndex === -1) return signedValue;
  return signedValue.substring(0, dotIndex);
}

export function isAdminClient(): boolean {
  if (typeof document === "undefined") return false;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split("=");
    const value = rest.join("=");
    if (name === ROLE_COOKIE_NAME && extractPayload(value) === "admin") {
      return true;
    }
  }
  return false;
}
```

Note: The client cannot verify the HMAC (it doesn't have SESSION_SECRET). It only extracts the payload for UI purposes. The server validates the signature on every request via middleware.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/auth-client.test.ts`
Expected: All 4 tests PASS.

**Step 5: Commit**

```
git add lib/auth-client.ts tests/unit/auth-client.test.ts
git commit -m "feat(auth): client-side role parsing handles signed cookies"
```

---

### Task 5: Rate Limiter

In-memory rate limiter keyed by IP with sliding window and auto-cleanup.

**Files:**
- Create: `lib/rate-limit.ts`
- Test: `tests/unit/rate-limit.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/rate-limit.test.ts`:

```typescript
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
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/rate-limit.test.ts`
Expected: FAIL — module `@/lib/rate-limit` does not exist.

**Step 3: Implement `lib/rate-limit.ts`**

```typescript
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
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/rate-limit.test.ts`
Expected: All 6 tests PASS.

**Step 5: Commit**

```
git add lib/rate-limit.ts tests/unit/rate-limit.test.ts
git commit -m "feat(auth): add in-memory login rate limiter"
```

---

### Task 6: Integrate Rate Limiter into Login Route

Wire the rate limiter into the login API. Extract client IP from headers.

**Files:**
- Modify: `app/api/auth/login/route.ts`
- Test: `tests/unit/login-route.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/login-route.test.ts`:

```typescript
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
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/login-route.test.ts`
Expected: FAIL — current login route doesn't check rate limits.

**Step 3: Update `app/api/auth/login/route.ts`**

Full replacement:

```typescript
import { NextResponse } from "next/server";
import { verifyLogin, createSession } from "@/lib/auth";
import { loginRateLimiter } from "@/lib/rate-limit";

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateCheck = loginRateLimiter.check(clientIp);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Too many login attempts. Please try again later.",
          code: "RATE_LIMITED",
          retryAfter: rateCheck.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateCheck.retryAfterSeconds),
          },
        },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { password } = body as { password?: string };

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 },
      );
    }

    const result = await verifyLogin(password);

    if (!result.valid) {
      loginRateLimiter.recordFailure(clientIp);
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    loginRateLimiter.reset(clientIp);
    await createSession(result.isAdmin);
    return NextResponse.json({
      success: true,
      isAdmin: result.isAdmin,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/login-route.test.ts`
Expected: Both tests PASS.

**Step 5: Commit**

```
git add app/api/auth/login/route.ts tests/unit/login-route.test.ts
git commit -m "feat(auth): rate-limit login endpoint (5 attempts / 15 min)"
```

---

### Task 7: Login Page Rate Limit Feedback

Show a "too many attempts" message with countdown when the server returns 429.

**Files:**
- Modify: `app/login/page.tsx:27-44`

**Step 1: Update the login form error handling**

In `app/login/page.tsx`, add a `retryAfter` state and update the fetch response handler. Within the `LoginForm` function:

Add state:

```typescript
const [retryAfter, setRetryAfter] = useState(0);
```

Add countdown effect (after the state declarations, before `handleSubmit`):

```typescript
useEffect(() => {
  if (retryAfter <= 0) return;
  const timer = setInterval(() => {
    setRetryAfter((prev) => {
      if (prev <= 1) {
        clearInterval(timer);
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
  return () => clearInterval(timer);
}, [retryAfter]);
```

Add `useEffect` to the import from `"react"`.

Update the error handling in the fetch block (replace the `else` branch at line 36-39):

```typescript
      } else if (res.status === 429) {
        const data = await res.json();
        setRetryAfter(data.retryAfter || 60);
        setError("Too many attempts. Please wait before trying again.");
      } else {
        const data = await res.json();
        setError(data.error || "Invalid password");
      }
```

Disable the submit button when rate limited. Update the button disabled condition:

```typescript
disabled={loading || retryAfter > 0}
```

Update the button label to show countdown when rate limited:

```typescript
{loading ? (
  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
) : retryAfter > 0 ? (
  <>Try again in {retryAfter}s</>
) : (
  <>
    Sign In
    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
  </>
)}
```

**Step 2: Manually verify**

No unit test for this step — it's pure UI. Verify by:
1. Start dev server: `npm run dev`
2. Go to `http://localhost:3000/login`
3. Enter wrong password 5 times rapidly
4. Confirm the 429 message appears with countdown

**Step 3: Commit**

```
git add app/login/page.tsx
git commit -m "feat(auth): login page shows rate-limit countdown"
```

---

### Task 8: Password Hashing in `verifyLogin`

Add scrypt-based password verification with fallback to plain text.

**Files:**
- Modify: `lib/auth.ts` (verifyLogin function only)
- Create: `scripts/hash-password.ts`
- Test: `tests/unit/auth-hash.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/auth-hash.test.ts`:

```typescript
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
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/auth-hash.test.ts`
Expected: FAIL — current `verifyLogin` doesn't check `_HASH` vars.

**Step 3: Update `verifyLogin` in `lib/auth.ts`**

Add imports at the top of `lib/auth.ts`:

```typescript
import { scryptSync, timingSafeEqual } from "crypto";
```

Replace the `verifyLogin` function:

```typescript
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
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/auth-hash.test.ts`
Expected: All 5 tests PASS.

Also run all auth tests:

Run: `npx vitest run tests/unit/auth.test.ts tests/unit/auth-hash.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```
git add lib/auth.ts tests/unit/auth-hash.test.ts
git commit -m "feat(auth): scrypt password hashing with plain-text fallback"
```

---

### Task 9: Password Hash Generator Script

Helper script so operators can generate `salt:hash` strings.

**Files:**
- Create: `scripts/hash-password.ts`

**Step 1: Create the script**

```typescript
import { scryptSync, randomBytes } from "crypto";
import { createInterface } from "readline";

const rl = createInterface({ input: process.stdin, output: process.stdout });

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function main() {
  console.log("\nShiftAware Password Hash Generator\n");

  const password = await question("Enter password to hash: ");

  if (!password.trim()) {
    console.error("Password cannot be empty.");
    process.exit(1);
  }

  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  const result = `${salt}:${hash}`;

  console.log("\nGenerated hash (copy this into your .env):\n");
  console.log(result);
  console.log("\nExample .env line:");
  console.log(`ADMIN_PASSWORD_HASH=${result}\n`);

  rl.close();
}

main();
```

**Step 2: Test manually**

Run: `echo testpassword | npx tsx scripts/hash-password.ts`
Expected: Outputs a `salt:hash` string.

**Step 3: Commit**

```
git add scripts/hash-password.ts
git commit -m "feat(auth): add password hash generator script"
```

---

### Task 10: Update Environment Config & Health Check

Update `.env.example`, `scripts/check-env.js`, `docker-compose.prod.yml`, and health check.

**Files:**
- Modify: `.env.example:14-21`
- Modify: `scripts/check-env.js:42-52`
- Modify: `docker-compose.prod.yml:11`
- Modify: `app/api/health/route.ts:9-11`

**Step 1: Update `.env.example`**

Replace the Authentication section (lines 14-25):

```
# ============================================================================
# Authentication
# ============================================================================
# Session signing secret (64+ hex chars recommended).
# Auto-generated in dev if missing. MUST be set in production.
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=

# --- Password options (choose ONE approach) ---

# Option A: Hashed passwords (recommended for production)
# Generate with: npx tsx scripts/hash-password.ts
# Format: salt:scrypthash (hex)
ADMIN_PASSWORD_HASH=
# USER_PASSWORD_HASH=

# Option B: Plain-text passwords (dev only, logs a warning)
ADMIN_PASSWORD=Admin123!
# USER_PASSWORD=

# Session timeout in minutes (default: 60)
SESSION_TIMEOUT_MINUTES=60
```

**Step 2: Update `scripts/check-env.js`**

After the existing `adminPassword` check (line 42-52), add hash detection:

```javascript
const adminHash = env.ADMIN_PASSWORD_HASH?.trim();
const sessionSecret = env.SESSION_SECRET?.trim();

console.log('\nADMIN_PASSWORD_HASH:');
console.log('  exists:', !!adminHash);
if (adminHash) {
  console.log('  format:', adminHash.includes(':') ? 'valid (salt:hash)' : '⚠ INVALID (missing colon separator)');
}

console.log('\nSESSION_SECRET:');
console.log('  exists:', !!sessionSecret);
console.log('  length:', sessionSecret?.length || 0);
if (sessionSecret && sessionSecret.length < 32) {
  console.log('  ⚠ WARNING: SESSION_SECRET should be at least 32 characters');
}

if (!adminHash && adminPassword) {
  console.log('\n⚠ WARNING: Using plain-text ADMIN_PASSWORD.');
  console.log('  For production, run: npx tsx scripts/hash-password.ts');
  console.log('  Then set ADMIN_PASSWORD_HASH and remove ADMIN_PASSWORD.');
}
```

**Step 3: Update `docker-compose.prod.yml`**

Replace line 11 (`ADMIN_PASSWORD`) with both hash vars:

```yaml
      ADMIN_PASSWORD_HASH: ${ADMIN_PASSWORD_HASH}
      USER_PASSWORD_HASH: ${USER_PASSWORD_HASH:-}
      SESSION_SECRET: ${SESSION_SECRET}
```

Keep `ADMIN_PASSWORD: ${ADMIN_PASSWORD:-}` as optional fallback line.

**Step 4: Update health check**

In `app/api/health/route.ts`, replace the `ADMIN_PASSWORD` check (line 9-11):

```typescript
  const hasAdminAuth =
    !!process.env.ADMIN_PASSWORD_HASH?.trim() ||
    !!process.env.ADMIN_PASSWORD?.trim();
  if (!hasAdminAuth) {
    missing.push("ADMIN_PASSWORD_HASH or ADMIN_PASSWORD");
  }
```

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

**Step 6: Commit**

```
git add .env.example scripts/check-env.js docker-compose.prod.yml app/api/health/route.ts
git commit -m "chore(auth): update env config, health check, and prod compose for hashed passwords"
```

---

### Task 11: Documentation Updates

Update the three docs files identified in the design.

**Files:**
- Modify: `docs/ARCHITECTURE.md` (add subsection after line ~67)
- Modify: `docs/API.md` (expand Authentication section, lines 16-30)
- Modify: `docs/PROJECT-OVERVIEW.md` (fix broken Auth link, line 17)

**Step 1: Add "Authentication & Session Security" to ARCHITECTURE.md**

Insert after the Route Layer box (after line 67), before the Service Layer box:

```markdown
### Authentication & Session Security

ShiftAware uses a shared-password model with two roles (admin, user). The auth system has three layers of protection:

**Signed session cookies.** All session cookies (`authenticated`, `user_role`) are HMAC-SHA256 signed using `SESSION_SECRET`. The middleware verifies signatures on every request — forged cookies are rejected. The client reads the role payload (before the `.` separator) for UI purposes only; the server is the sole authority.

**Login rate limiting.** An in-memory rate limiter tracks failed login attempts per IP address. After 5 failures within 15 minutes, the IP is locked out with a 429 response. The sliding window resets on successful login. This is sufficient for single-instance deployments — no external store (Redis) needed.

**Hashed passwords.** Passwords are stored as `salt:scryptHash` in `ADMIN_PASSWORD_HASH` / `USER_PASSWORD_HASH` env vars. Scrypt is memory-hard, making brute-force expensive even if hashes leak. Verification uses `timingSafeEqual` to prevent timing side-channels. Plain-text `ADMIN_PASSWORD` is supported as a dev fallback with a logged warning.

Key files: `lib/crypto.ts` (signing), `lib/rate-limit.ts` (throttling), `lib/auth.ts` (verification), `middleware.ts` (enforcement).
```

**Step 2: Expand Authentication section in API.md**

Replace the Authentication section (lines 16-30):

```markdown
## Authentication

Session-based authentication using HMAC-signed cookies. Two shared passwords: admin and user.

### Rate Limiting

Login attempts are rate-limited per IP address. After 5 failed attempts within 15 minutes, the endpoint returns `429 Too Many Requests` with a `Retry-After` header. The counter resets on successful login.

### `POST /api/auth/login`
**Auth required:** No
**Body:** `{ "password": string }`
**Success (200):** `{ "success": true, "isAdmin": boolean }` + sets signed session cookies
**Invalid (401):** `{ "error": "Invalid password" }`
**Rate limited (429):** `{ "error": "Too many login attempts...", "code": "RATE_LIMITED", "retryAfter": number }`

### `POST /api/auth/logout`
**Auth required:** Yes
**Response:** `{ "success": true }` + clears session cookies

### `GET /api/auth/check`
**Auth required:** No
**Response:** `{ "authenticated": boolean }`
```

**Step 3: Fix broken Auth link in PROJECT-OVERVIEW.md**

Replace `[Auth](#)` with `[Auth](./API.md#authentication)`.

**Step 4: Commit**

```
git add docs/ARCHITECTURE.md docs/API.md docs/PROJECT-OVERVIEW.md
git commit -m "docs: document auth security (signed sessions, rate limiting, hashed passwords)"
```

---

### Task 12: Full Regression Test

Run the complete test suite and verify the dev server works end-to-end.

**Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All tests pass, including all new auth tests.

**Step 2: Start dev server and manual smoke test**

Run: `npm run dev`

1. Go to `http://localhost:3000/login`
2. Log in with the plain-text `ADMIN_PASSWORD` from `.env`
3. Confirm redirect to `/app/identity`
4. Open dev tools → Application → Cookies → confirm `authenticated` and `user_role` values contain a `.` (signed)
5. Try to forge: edit `user_role` cookie to `admin.fake` → refresh → should be treated as unauthenticated
6. Log out → try wrong password 5 times → confirm 429 message with countdown

**Step 3: Commit any fixes if needed**

If any issues are found, fix and commit with descriptive message.

**Step 4: Final commit**

If no fixes needed, no commit. The feature is complete.

```
git log --oneline -10
```

Expected commits (newest first):
- `docs: document auth security (...)`
- `chore(auth): update env config, health check, and prod compose for hashed passwords`
- `feat(auth): add password hash generator script`
- `feat(auth): scrypt password hashing with plain-text fallback`
- `feat(auth): login page shows rate-limit countdown`
- `feat(auth): rate-limit login endpoint (5 attempts / 15 min)`
- `feat(auth): client-side role parsing handles signed cookies`
- `feat(auth): middleware validates signed cookies`
- `feat(auth): integrate HMAC signing into session cookies`
- `feat(auth): add HMAC cookie signing utility`
