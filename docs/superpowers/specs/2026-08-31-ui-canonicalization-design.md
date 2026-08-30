# UI Canonicalization

**Date:** 2026-08-31
**Branch:** Feature-v2.6-Backlog

---

## Overview

A codebase-wide survey (grep across `app/`, `components/`, `app/globals.css`,
`tailwind.config.ts`) found the UI is **mostly consistent already** —
`components/ui/` has a real set of shared primitives (`Button`, `Card`,
`Input`, `Select`, `GlassPanel`, `StatusBadge`, `ConfirmDialog`, `Toast`,
etc.), `lucide-react` is the only icon library anywhere, and icon sizing
(`w-4 h-4` dominant) and border-radius (`rounded-lg` dominant) are both
largely uniform. This is not a rewrite-everything situation.

There are five concrete gaps worth fixing, in descending order of actual
impact:

1. **Two disagreeing color systems** — `primary` is a confirmed bug (two
   different blues rendered by the same class name depending on which
   system you'd expect); `secondary`/`accent` are dead-duplicated rather
   than conflicting; `error` isn't a conflict at all, just an entirely
   unbacked color family. All four get one fix: point at CSS-variable
   tokens, adding the one scale (`error`) that doesn't exist yet.
2. **A genuine contrast bug** in `Button`'s `destructive` variant.
3. **No generic colored-pill primitive**, so one recurring shape (icon +
   label, colored background, rounded-full) gets hand-rolled slightly
   differently each time.
4. **Two competing confirmation patterns** (`window.confirm` vs
   `ConfirmDialog`) with no documented rule for which to use when.
5. **Minor drift**: `rounded-xl` vs `rounded-2xl` used interchangeably for
   "big container," and ~9 files still hand-roll a Card-shaped wrapper div
   instead of using `<Card>`/`<GlassPanel>`.

This spec fixes all five and documents the resulting rules — it does
**not** mandate converting every one of the ~65 raw `<button>` elements
found in the survey; most are legitimately custom (segmented toggles,
dropdown rows, icon-only close buttons) that don't fit `Button`'s
variant/size set, and forcing them into it would be the over-engineering
this project's own conventions explicitly warn against.

---

## 1. Color tokens: `tailwind.config.ts` is dead code, and `error` is a live bug

**Correction (found during plan-stage Gate 2 docs-first verification,
2026-08-31):** this section originally diagnosed a "two systems disagree"
problem and proposed reconciling `tailwind.config.ts` with `globals.css`.
That diagnosis was wrong. This project runs **Tailwind CSS v4**
(`package.json`: `"tailwindcss": "^4.0.0"`), and `app/globals.css:1-3` uses
the v4 CSS-first setup — `@import "tailwindcss";` followed directly by an
`@theme { ... }` block. `postcss.config.cjs` registers `@tailwindcss/postcss`
with no config path, and no file anywhere in the repo contains an `@config`
directive (confirmed via grep). **Tailwind v4 has no mechanism that reads
`tailwind.config.ts` unless a CSS file explicitly `@config`s it — so the
file is never loaded.** Its 195 lines (`primary`/`secondary`/`accent`/
`success`/`error`/`warning`/`info`/`gray`/`shift-*` colors, the `fontSize`/
`boxShadow`/`borderRadius`/`borderWidth` extensions, even the `content`
array) are pure dead code today.

Two consequences, verified live (`playwright-cli`, injecting a probe
element and reading `getComputedStyle`):

1. **The "primary mismatch" isn't real.** `bg-primary-600` already renders
   `globals.css`'s indigo (`--color-primary-600: hsl(220, 58%, 45%)`) in
   the actual app, because `@theme` is the only place that color could
   come from — `tailwind.config.ts`'s sky-blue `#0284c7` never reaches the
   browser. Same for `accent`/`success`: they already render from
   `@theme`, unconditionally. No reconciliation needed for any of these
   three.
2. **`error` is a genuine, currently-live bug — not a contrast nitpick.**
   `globals.css`'s `@theme` block never defines an `--color-error-*` scale
   (confirmed: grepped the full 352-line file). `tailwind.config.ts` does
   define one, but since that file is dead, every `error-*` Tailwind class
   in the codebase today generates **zero CSS**. Confirmed live: a probe
   div with `class="bg-error-600 text-error-600 border-error-300"`
   resolved to `background: transparent`, `color:` the default body-text
   color, `border-color:` the default gray reset — no red anywhere. This
   class is used in five real files:
   `components/ui/Input.tsx` (required-field asterisk, invalid-state
   border/ring), `components/ui/Select.tsx` (invalid-state border/ring),
   `components/ui/Button.tsx` (destructive variant background, §2), and
   two admin pages' delete icons (`DistributionSettings.tsx:765`,
   `AttributeDefinitions.tsx:325`). **All of it is silently rendering with
   no red indication today** — required-field markers, validation-error
   borders, and destructive buttons all look like normal UI. This is a
   correctness bug, not a preference.
   (`secondary`/`warning`/`info`/custom `gray`/`shift-*` are also dead but
   have zero live usages — grepped, no matches — so they need no fix
   beyond removing the dead file.)

**Fix:** add `--color-error-50..900` directly to `app/globals.css`'s
`@theme` block (the same pattern as the existing `--color-success-50..900`
entries at `globals.css:33-43`) — this is the only place that produces a
real Tailwind utility in this project. No `tailwind.config.ts` edit can fix
this, because nothing reads that file.

**New scope item, needs your confirmation:** delete `tailwind.config.ts`
entirely. It is fully dead code under this build, and leaving it in place
is exactly what let this bug hide — a future edit to "fix" a color there
would silently do nothing again. If there's a reason to keep it (e.g. a
tool outside the Next.js build still reads it), say so and this becomes
"leave in place, add a comment marking it unused" instead.

---

## 2. Fix: `Button`'s `destructive` variant

**File:** `components/ui/Button.tsx:49-50`

```ts
// before
destructive: "bg-error-600 text-red-600 hover:bg-error-700 active:bg-error-800 ...",

// after
destructive: "bg-error-600 text-white hover:bg-error-700 active:bg-error-800 ...",
```

Today this variant has no visible background at all (§1 — `bg-error-600`
is a phantom class), so `text-red-600` (a real default-palette color,
unaffected by §1) is the only color currently showing — on whatever the
button's fallback background is. Once §1 adds `--color-error-*` to
`@theme`, `bg-error-600` starts rendering a real dark red, and at that
point medium-red text on a dark-red background becomes the readability
defect the original diagnosis described — so the fix (`text-white`, the
only variant not already using it for a saturated background, matching
`primary`) is still correct, just for a diagnosis that only becomes true
after §1 ships. **Sequencing matters: §2 must land after §1**, or this
variant briefly regresses from "invisible" to "actively hard to read"
with no red at all in between only being fixed by luck of ordering.

---

## 3. New primitive: `Pill`

**Problem:** the mobile "swaps pending" badge
(`app/admin/shifts/schedule/page.tsx`, the button fixed for overlap
earlier this session) hand-rolls `flex items-center gap-1.5 bg-amber-50
border border-amber-200 text-amber-800 rounded-full px-3 py-1.5 text-xs
font-bold`. This exact shape — icon/emoji + label, colored background,
rounded-full, small padding — is the same visual language `StatusBadge`
already uses internally (`components/ui/StatusBadge.tsx:61-71`,
`rounded-full ... px-3 py-1.5 ... border`) but `StatusBadge` is hardcoded
to the `EventStatus` enum specifically, not reusable for an arbitrary
clickable pill.

**Fix:** extract a small generic `components/ui/Pill.tsx`:

```tsx
interface PillProps {
  tone: "gray" | "sky" | "orange" | "green" | "amber";
  pulse?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}
```

Same `bg-*-50 text-*-700 border-*-200` tone mapping `StatusBadge` already
has, extracted so both `StatusBadge` and the swap-pending badge (and any
future colored-pill need) consume one implementation. `StatusBadge`
becomes a thin wrapper: `<Pill tone={toneFor(status)} pulse={...}>{label}</Pill>`
plus its own status-dot. The swap-pending badge becomes
`<Pill tone="amber" onClick={...}>⇄ {swapCount} swaps pending ↑</Pill>`.

---

## 4. Confirmation pattern: one rule

**Problem:** `useToast` is used consistently (15 files) for success/error
feedback — no issue there. But two different confirmation mechanisms
exist for destructive/impactful actions: `window.confirm(...)` (10 call
sites, e.g. `ShiftPropertiesPanel.tsx:203`, the event-status-transition
confirm in `app/admin/shifts/schedule/page.tsx:117`) and the dedicated
`ConfirmDialog` component (5 files), with no documented distinction.

**Fix — codify the rule that's already implicitly being followed most of
the time**, rather than forcing everything into one mechanism:

- **`window.confirm(...)`** — a single-object, immediately-reversible-by-
  recreating-it action (delete one shift, delete one marker, decline one
  swap). Matches the admin hard-constraint-override confirm added earlier
  this session, which deliberately chose `confirm()` for exactly this
  reason.
- **`ConfirmDialog`** — a multi-step, harder-to-undo, or event-wide action
  (event status transitions, bulk operations, anything affecting more than
  one record).

Apply this rule to the existing 10 `window.confirm` call sites: audit each
against the rule above and convert only the ones that are actually
multi-record/hard-to-undo (the event-status-transition confirm at
`app/admin/shifts/schedule/page.tsx:117` is the clearest candidate — it
changes the whole event's workflow state, not one record). Single-object
deletes stay as `confirm()`.

---

## 5. Minor drift cleanup

- **`rounded-xl` vs `rounded-2xl`**: codify "cards/panels get `rounded-xl`;
  modals and full-page major sections get `rounded-2xl`" (matches the
  current majority usage for each already — this is documentation of
  existing dominant practice, not a new convention, so it requires
  touching only the minority of files that currently disagree with it).
- **~9 files hand-rolling a Card-shaped wrapper** (`rounded-xl shadow-sm
  border` or similar, found via the survey's Card/panel grep) — convert
  each to `<Card>` or `<GlassPanel>` (whichever the surrounding page
  already uses for its other panels), once the specific 9 are identified
  during implementation (the survey sampled broadly but didn't need to
  enumerate every path for this level of design decision).

---

## Testing / verification approach

This spec is a sweep, not a single feature — the real risk is regressing
existing behavior in many small edits rather than any one piece being
complex. Verification plan:

- Run the full `vitest` suite after each of §1-§5's changes individually
  (not batched into one giant diff), since several existing component
  tests likely assert exact class strings (e.g. a test checking a button's
  className contains `bg-error-600`) that the destructive-variant fix in
  §2 could legitimately need to update.
- `tsc --noEmit` after the Tailwind config change in §1 — Tailwind config
  isn't type-checked directly, but confirm no build-time Tailwind error
  from the new `var(...)`-based color values (Tailwind can consume
  arbitrary CSS var strings as color values; confirm this actually
  compiles as expected rather than assuming it).
- Live visual spot-check (`playwright-cli`, as used throughout this
  session) across a representative page from each major area — admin
  setup, schedule canvas, distribution control center, team management,
  user calendar — after §1's token change specifically, since it's the
  one change with app-wide visual blast radius.

---

## Out of scope

- Converting every legitimately-custom raw `<button>` into `<Button>` —
  the survey found most aren't duplication, they're shapes `Button`'s
  variant set doesn't (and shouldn't necessarily) cover.
- A wholesale spacing-scale audit — the survey found icon sizing and
  radius already substantially consistent; only the two specific drifts
  in §5 are real.
- Introducing a new component library, theming system, or dark-mode
  support — none of that was requested; this is a consistency pass on
  what already exists.
