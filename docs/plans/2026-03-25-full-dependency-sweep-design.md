# Full Dependency Sweep — Design

**Date:** 2026-03-25
**Branch:** `chore/next-systematic-upgrade`
**Status:** Approved

## Problem

7 npm vulnerabilities remain after the safe audit fix:
- 1 critical: Next.js 15.1.12 has 8 CVEs (middleware auth bypass, SSRF, DoS, image optimization attacks)
- 5 moderate: esbuild <=0.24.2 → vite → vitest chain
- 1 low: brace-expansion ReDoS

## Decision

**Approach A: Two separate commits** — upgrade Next.js first (production fix), then vitest/vite/lint (dev tooling fix). Each commit independently rollbackable.

### Why not all-at-once?

Mixing production dependency risk with dev tooling risk makes failures harder to isolate. The Next.js upgrade is near-zero risk; the vitest 2→4 jump has known behavior changes.

### Why not incremental vitest (2→3→4)?

Vitest 3 is already EOL. The intermediate step adds effort with no lasting value. The codebase uses standard mocking patterns that survived both major versions.

## Risk Assessment

### Next.js 15.1.12 → 15.5.14: Very Low

Codebase scan found zero usage of APIs that changed between 15.1 and 15.5:
- `cookies()` already awaited
- No `legacyBehavior` on Link
- No `next/image` imports
- No `generateMetadata`/`generateStaticParams`
- No `useFormState`/`useFormStatus`
- Middleware uses default Edge runtime, unaffected
- `next.config.ts` is minimal (standalone output, eslint ignore)

### Vitest 2.1.9 → 4.x: Low-Medium

- 1 test file uses `vi.useFakeTimers()` — defaults changed in v3 (now includes `performance.now()`)
- All 20+ test files use `vi.mock` with factory functions + `clearAllMocks` — stable pattern
- No `SpyInstance`, no `mockReset`, no `toThrowError` comparisons
- Node.js 24 satisfies requirement (>=20)

### Lint Migration: Zero Risk

Changing `"next lint"` → `"eslint ."` in package.json scripts. Functionally identical.

## Implementation Plan

See: `docs/plans/2026-03-25-full-dependency-sweep.md`
