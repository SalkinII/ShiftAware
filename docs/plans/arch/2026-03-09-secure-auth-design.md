# Secure Auth: Signed Sessions, Rate Limiting & Hashed Passwords

> Design approved 2026-03-09. Pragmatic security hardening for internet-facing deployment.

## Context

ShiftAware uses a shared-password model (one admin password, one optional user password). The current implementation has three vulnerabilities, listed by exploitability:

1. **Forgeable session cookies** — `authenticated=true` can be set in browser dev tools to bypass login entirely.
2. **No brute-force protection** — the login endpoint accepts unlimited attempts per second.
3. **Plain-text password comparison** — passwords stored as env vars are visible via `docker inspect`, process listings, or accidental log output.

An external suggestion proposed Docker Secrets + scrypt hashing. After critical review, we identified that it focused on the least-exploitable issue (#3) while ignoring #1 and #2, and that Docker Secrets provide minimal benefit in a non-Swarm Compose setup. This design addresses all three in priority order.

## Threat Model

- Internet-facing Next.js app behind a reverse proxy
- Shared passwords known by multiple people (likely short/memorable)
- Single-instance deployment (Docker Compose, no Swarm)
- No individual user accounts — two roles: admin and user

## Design

### 1. Signed Session Cookies

**Problem:** The `authenticated` cookie is the string `"true"`. The `user_role` cookie is `"admin"` or `"user"`. Both are trivially forgeable.

**Solution:** HMAC-sign cookie values using a server-side secret.

- `SESSION_SECRET` env var holds a random key (64 hex chars recommended).
- If not set, auto-generate on startup and log a warning. Auto-generation means dev "just works"; production should set it explicitly so it survives restarts.
- Cookie values become `payload.hmacSignature` (e.g., `true.a3f8b2...`, `admin.7c1d9e...`).
- Reading cookies verifies the HMAC. Invalid signature = treat as unauthenticated.
- Uses `crypto.createHmac('sha256', SESSION_SECRET)`.

**Files changed:**

| File | Change |
|------|--------|
| `lib/auth.ts` | `createSession` signs values; `isAuthenticated`/`isAdmin`/`validateSessionCookie` verify signatures |
| `middleware.ts` | Uses signature-aware validation (already calls `validateSessionCookie`) |
| `lib/auth-client.ts` | Parse `user_role` value before the dot separator |
| `.env.example` | Add `SESSION_SECRET` |
| `scripts/check-env.js` | Warn if `SESSION_SECRET` is missing in production |

### 2. Rate Limiting on Login

**Problem:** No throttling on `POST /api/auth/login`. Brute-force is the most realistic attack vector with shared passwords.

**Solution:** In-memory rate limiter keyed by IP address, scoped to the login endpoint.

- `Map<string, { count: number, resetAt: number }>` tracks failed attempts per IP.
- **Threshold:** 5 failed attempts within a 15-minute sliding window.
- **Lockout:** 15 minutes from last failed attempt. Each new failure resets the timer.
- **Response:** `429 Too Many Requests` with `Retry-After` header and `{ "error": "Too many login attempts", "code": "RATE_LIMITED", "retryAfter": <seconds> }`.
- **On success:** Counter resets for that IP.
- **Cleanup:** Periodic sweep every 5 minutes evicts expired entries.
- **IP extraction:** Read `x-forwarded-for` header first, fall back to direct IP. Important for Docker behind reverse proxy.

In-memory resets on server restart — acceptable for a single-instance app.

**Files changed:**

| File | Change |
|------|--------|
| `lib/rate-limit.ts` (new) | Rate limiter class: `check(ip)`, `recordFailure(ip)`, `reset(ip)` |
| `app/api/auth/login/route.ts` | Check rate limit before verify, record failure/reset on result |
| `app/login/page.tsx` | Show "too many attempts" message on 429, display countdown |

### 3. Hashed Passwords

**Problem:** `verifyLogin` does `password === adminPassword` — plain-text comparison against env vars.

**Solution:** Store passwords as `salt:scryptHash` in env vars. Verify by hashing input with stored salt.

- New env vars: `ADMIN_PASSWORD_HASH` and `USER_PASSWORD_HASH` in format `salt:hash`.
- Verification: `scryptSync(input, salt, 64)` compared with `timingSafeEqual`.
- **Fallback:** If `_HASH` variant not set, fall back to plain-text `ADMIN_PASSWORD`/`USER_PASSWORD` with a logged warning. Local dev doesn't break.
- **Production:** `scripts/check-env.js` warns if plain-text vars are used.
- **Helper:** `scripts/hash-password.ts` generates `salt:hash` strings interactively.

**Why not Docker Secrets:** In non-Swarm Compose, secrets are just bind-mounted files — not encrypted in memory. The hash itself is safe to expose. Env vars are operationally simpler and equally secure. Docker Secrets can be adopted later if deployment moves to Swarm/K8s.

**Files changed:**

| File | Change |
|------|--------|
| `lib/auth.ts` | `verifyLogin` checks `_HASH` vars first, falls back to plain-text with warning |
| `scripts/hash-password.ts` (new) | Interactive helper to generate `salt:hash` strings |
| `scripts/check-env.js` | Warn if plain-text password vars used in production |
| `.env.example` | Add `ADMIN_PASSWORD_HASH`, `USER_PASSWORD_HASH` with format docs |
| `docker-compose.prod.yml` | Use `ADMIN_PASSWORD_HASH` instead of `ADMIN_PASSWORD` |

## Documentation Plan

| Doc | Section | What to add |
|-----|---------|-------------|
| `docs/ARCHITECTURE.md` | New "### Authentication & Session Security" subsection | Signed cookies mechanism, hashing scheme (why scrypt), rate-limiting strategy (why in-memory), IP extraction |
| `docs/API.md` | Expand "## Authentication" | 429 response format, `Retry-After` header, lockout behavior, note that passwords are hashed server-side |
| `docs/PROJECT-OVERVIEW.md` | Doc index table | Fix broken `[Auth](#)` link → `API.md#authentication` |
| `.env.example` | Inline | `SESSION_SECRET`, `ADMIN_PASSWORD_HASH`, `USER_PASSWORD_HASH` with format examples |

## Migration Path

1. Generate `SESSION_SECRET` and add to `.env`
2. Generate password hashes: `npx tsx scripts/hash-password.ts`
3. Set `ADMIN_PASSWORD_HASH` (and optionally `USER_PASSWORD_HASH`) in `.env`
4. Remove plain-text `ADMIN_PASSWORD` / `USER_PASSWORD` from production env
5. Restart the container

Existing deployments continue working unchanged until step 2 — the plain-text fallback ensures backward compatibility.

## What This Design Does NOT Include

Explicitly out of scope (can be revisited later):

- **Docker Secrets** — marginal benefit in non-Swarm Compose
- **Server-side session store** — overkill for shared-password model
- **CSRF tokens** — login form is a simple POST, no state-changing GET routes
- **Session revocation** — would require DB-backed sessions
- **Individual user accounts / OIDC** — different product scope entirely
