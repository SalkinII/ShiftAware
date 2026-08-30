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

## 1. Color tokens: single source of truth

**Problem:** `app/globals.css:15-18` defines `--color-primary-500..800` as
HSL blues (`hsl(220, 58%, 45%)` for 600). `tailwind.config.ts:41-52`
separately defines a `primary` palette as **different hex blues**
(`#0284c7` for 600 — sky/cyan, not indigo). `bg-primary-600` and
`var(--color-primary-600)` currently render two different colors. Same
issue for `secondary`/`accent` (`tailwind.config.ts:53-77`) against the CSS
vars' semantic equivalents — and `secondary` and `accent` in
`tailwind.config.ts` are byte-for-byte identical to each other (dead
duplication on top of the mismatch).

**Fix:** the CSS-variable system in `globals.css` is the richer one
(semantic tokens like `--status-bg`, `--glass-bg`, per-status accent
colors that the Tailwind palette has no equivalent for) — it becomes the
single source of truth, for the three color families that actually have a
matching CSS-var scale today:

- `primary` → `var(--color-primary-50..900)` (the confirmed mismatch —
  `tailwind.config.ts`'s hardcoded sky-blue vs. `globals.css`'s indigo-blue).
- `secondary` and `accent` → both point at `var(--color-accent-50..900)`.
  `globals.css` only defines `--color-accent-*` (no separate
  `--color-secondary-*` — matching `tailwind.config.ts:54`'s own comment,
  "Using accent as secondary for now"), and `accent-*` classes are
  actually used (`app/admin/shifts/schedule/page.tsx`,
  `app/admin/audit/page.tsx`, `app/login/page.tsx`) so neither key is dead
  weight to delete — they become two names for one var-backed scale
  instead of two copies of one hardcoded scale.
- `success` → `var(--color-success-50..900)` (exists in `globals.css:34-43`;
  confirm the two scales' actual rendered colors during implementation —
  unlike `primary`, this pair wasn't confirmed to visibly clash, but
  should still be var-backed for the same single-source-of-truth reason).

**`error` is a different kind of gap, not a conflict**: `globals.css` has
no `--color-error-*` scale at all — only a single semantic
`--color-unfilled` shade (`hsl(10, 75%, 55%)`, `globals.css:225`), not a
50-900 range. There's nothing to redirect Tailwind's `error` palette to
yet. Since `Button`'s `destructive` variant (fixed in §2) is the one
variant still sourced from a palette with no CSS-var backing once
`primary`/`secondary`/`accent`/`success` are converted, add a
`--color-error-50..900` HSL scale to `globals.css` (following the same
pattern as the existing `--color-success-*` block) and point Tailwind's
`error` at it — closing the gap rather than leaving one color family
permanently unbacked.

---

## 2. Fix: `Button`'s `destructive` variant contrast bug

**File:** `components/ui/Button.tsx:49-50`

```ts
// before
destructive: "bg-error-600 text-red-600 hover:bg-error-700 active:bg-error-800 ...",

// after
destructive: "bg-error-600 text-white hover:bg-error-700 active:bg-error-800 ...",
```

Dark-red background with medium-red text is a real readability defect
(and the only variant not using `text-white`/`text-gray-700` consistently
with its background darkness — `primary` already uses `text-white` on the
same kind of saturated background). This is a bug fix, not a preference.

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
