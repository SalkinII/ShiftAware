# UI Token Foundation & Status Theming

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish a coherent, single-source-of-truth design token system, eliminate hardcoded colors in `ShiftBlockNode`, and implement event-status ambient theming via CSS — without changing architecture, moving files, or adding abstractions.

**Architecture:**
- CSS-first tokens: `app/globals.css @theme` is the canonical source. `tailwind.config.ts` is kept in sync for Tailwind utility generation but all semantic meaning lives in CSS vars.
- Status ambient theming via `data-event-status` HTML attribute on page wrappers + CSS `[data-event-status]` selectors — zero JS color logic.
- No new components. No file restructure. Only surgical edits to existing files.

**Tech Stack:** Tailwind v4 (`@theme`, `@layer base`), React Flow v12 (`@xyflow/react`), Next.js 15 App Router

---

## Background: Current Problems

### Problem 1 — Token system is split and inconsistent

`globals.css @theme` defines:
```css
--color-primary-500: hsl(220, 60%, 55%);   /* slate-blue */
--color-shift-mobile1: var(--color-primary-500);
```

`tailwind.config.ts extend.colors` defines:
```ts
primary: { 500: '#0ea5e9' }   /* sky-blue — what the UI actually renders */
```

In Tailwind v4, `@theme` CSS vars override JS config. So `bg-primary-500` renders as the HSL slate-blue from globals.css — which conflicts with the hex sky-blue intent in tailwind.config.ts. The globals.css `@theme` primary scale must be rewritten to match the actual intended palette.

**Fix:** Align `globals.css @theme` to the definitive hex values currently in `tailwind.config.ts`. Remove the redundant duplicate scale from `tailwind.config.ts` after alignment (it becomes noise once globals.css is correct).

### Problem 2 — No lane color CSS identity

`ShiftBlockNode` receives `color: string` (raw hex from `ShiftTemplate.color` DB field). This is correct — template colors are user-configurable. But:
- There are no named CSS vars for the standard template types
- Other components (lane labels, legend) cannot reference "mobile-north blue" symbolically
- The `ShiftBlockNode` uses `color-mix()` for its border, which is fine. But the "assigned to me" and "selected" border colors are hardcoded hex values.

**Fix:** Add `--lane-{type}` CSS vars in `@layer base` for the standard template types (informational only — the DB color remains authoritative for the node itself). Replace hardcoded hex in ShiftBlockNode with named vars.

### Problem 3 — Hardcoded colors in ShiftBlockNode

```tsx
// Hardcoded — should use design tokens:
borderColor: isAssignedToCurrentUser ? '#16a34a' : selected ? '#1d4ed8' : ...

// Hardcoded inline rgba for desirability score:
backgroundColor: desirabilityScore <= 2
  ? 'rgba(59, 130, 246, 0.3)'   // blue
  : desirabilityScore === 3
  ? 'rgba(156, 163, 175, 0.3)'  // gray
  : 'rgba(249, 115, 22, 0.3)'   // orange
```

**Fix:** Extract to named CSS vars in `@layer base`.

### Problem 4 — No event status ambient theming

`selectedEvent.status` is available everywhere via `useEventContext`, but the UI doesn't reflect it visually. The KIMI mockup shows status-tinted canvas backgrounds (sky-blue tint for OPEN_FOR_PREFERENCES, amber for ASSIGNING, etc.) which is achievable with pure CSS.

**Fix:** Apply `data-event-status="PLANNING|OPEN_FOR_PREFERENCES|..."` to admin page content wrappers. Define CSS overrides for `--status-bg`, `--status-accent` per status in `@layer base`.

---

## Task 1: Align Token System in globals.css

**What:** Rewrite the `@theme` block so the primary/success/accent color scales match the hex values in `tailwind.config.ts`. Add lane color vars and desirability-score vars to `@layer base`.

**Files:**
- Modify: `app/globals.css`

**Step 1: Verify current primary render**

Open browser DevTools on running app, inspect any `bg-primary-500` element, check computed `background-color`. Note actual rendered value — it will confirm which definition wins.

```bash
npm run dev
```

**Step 2: Rewrite primary scale in @theme to match tailwind.config.ts**

In `app/globals.css`, replace the primary HSL scale:

```css
@theme {
  /* PRIMARY — Sky blue (matches tailwind.config.ts, was incorrectly HSL) */
  --color-primary-50:  #f0f9ff;
  --color-primary-100: #e0f2fe;
  --color-primary-200: #bae6fd;
  --color-primary-300: #7dd3fc;
  --color-primary-400: #38bdf8;
  --color-primary-500: #0ea5e9;
  --color-primary-600: #0284c7;
  --color-primary-700: #0369a1;
  --color-primary-800: #075985;
  --color-primary-900: #0c4a6e;

  /* SUCCESS — Green (matches tailwind.config.ts) */
  --color-success-50:  #f0fdf4;
  --color-success-100: #dcfce7;
  --color-success-200: #bbf7d0;
  --color-success-300: #86efac;
  --color-success-400: #4ade80;
  --color-success-500: #22c55e;
  --color-success-600: #16a34a;
  --color-success-700: #15803d;
  --color-success-800: #166534;
  --color-success-900: #14532d;

  /* ACCENT / SECONDARY — Amber (matches tailwind.config.ts) */
  --color-accent-50:  #fffbeb;
  --color-accent-100: #fef3c7;
  --color-accent-200: #fde68a;
  --color-accent-300: #fcd34d;
  --color-accent-400: #fbbf24;
  --color-accent-500: #f59e0b;
  --color-accent-600: #d97706;
  --color-accent-700: #b45309;
  --color-accent-800: #92400e;
  --color-accent-900: #78350f;

  /* ERROR — Red */
  --color-error-50:  #fef2f2;
  --color-error-100: #fee2e2;
  --color-error-200: #fecaca;
  --color-error-300: #fca5a5;
  --color-error-400: #f87171;
  --color-error-500: #ef4444;
  --color-error-600: #dc2626;
  --color-error-700: #b91c1c;
  --color-error-800: #991b1b;
  --color-error-900: #7f1d1d;

  /* INFO — Blue */
  --color-info-50:  #eff6ff;
  --color-info-100: #dbeafe;
  --color-info-200: #bfdbfe;
  --color-info-300: #93c5fd;
  --color-info-400: #60a5fa;
  --color-info-500: #3b82f6;
  --color-info-600: #2563eb;
  --color-info-700: #1d4ed8;
  --color-info-800: #1e40af;
  --color-info-900: #1e3a8a;

  /* GRAY — Warm stone (matches tailwind.config.ts) */
  --color-gray-50:  #fafaf9;
  --color-gray-100: #f5f5f4;
  --color-gray-200: #e7e5e4;
  --color-gray-300: #d6d3d1;
  --color-gray-400: #a8a29e;
  --color-gray-500: #78716c;
  --color-gray-600: #57534e;
  --color-gray-700: #44403c;
  --color-gray-800: #292524;
  --color-gray-900: #1c1917;
}
```

**Step 3: Add lane color tokens and semantic vars to @layer base**

In `app/globals.css`, inside `@layer base :root { ... }`, add:

```css
/* Lane colors — authoritative identity for standard templates.
   These are CSS informational references; ShiftBlockNode still
   reads color from ShiftTemplate.color (DB). Use these in labels,
   legends, docs only. */
--lane-mobile-north:  #0ea5e9;   /* sky-500   */
--lane-mobile-south:  #f59e0b;   /* amber-500 */
--lane-stationary:    #22c55e;   /* green-500 */
--lane-shift-lead:    #8b5cf6;   /* violet-500 */
--lane-super:         #ef4444;   /* red-500   */
--lane-buffer:        #78716c;   /* stone-500 */

/* Shift node semantic interaction colors */
--shift-border-assigned-me: var(--color-success-600);  /* was #16a34a */
--shift-border-selected:    var(--color-info-700);     /* was #1d4ed8 */

/* Desirability score color scale (overlay on colored shift block) */
--desirability-low-bg:  rgba(59, 130, 246, 0.30);   /* low  ≤2: easy to get → blue */
--desirability-mid-bg:  rgba(156, 163, 175, 0.30);  /* mid   3: moderate  → gray */
--desirability-high-bg: rgba(249, 115, 22, 0.30);   /* high ≥4: hard to get → orange */

/* Event status ambient colors — defaults (overridden by [data-event-status]) */
--status-bg:      transparent;
--status-accent:  var(--color-gray-400);
```

**Step 4: Visual regression check**

```bash
npm run dev
```
Open `/admin/shifts/schedule`. Verify:
- Header logo background is still sky-blue (`bg-primary-500`)
- Sidebar active item is still sky-blue
- No visual regressions on any page

**Step 5: Commit**

```bash
git add app/globals.css
git commit -m "chore(tokens): align @theme color scale with tailwind.config.ts, add lane + semantic vars"
```

---

## Task 2: Replace Hardcoded Colors in ShiftBlockNode

**What:** Replace the 5 hardcoded color values in `ShiftBlockNode.tsx` with the CSS vars defined in Task 1.

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`

**Step 1: Locate all hardcoded colors**

```bash
grep -n "#16a34a\|#1d4ed8\|rgba(59\|rgba(156\|rgba(249" \
  components/features/LaneCalendar/nodes/ShiftBlockNode.tsx
```

Expected matches: `borderColor` (line ~90–97) and `backgroundColor` for desirability spans (lines ~155–162, ~229–243).

**Step 2: Replace borderColor logic**

Current:
```tsx
borderColor: isAssignedToCurrentUser
  ? "#16a34a"
  : selected
    ? "#1d4ed8"
    : `color-mix(in srgb, ${color} 70%, black)`,
```

Replace with:
```tsx
borderColor: isAssignedToCurrentUser
  ? "var(--shift-border-assigned-me)"
  : selected
    ? "var(--shift-border-selected)"
    : `color-mix(in srgb, ${color} 70%, black)`,
```

**Step 3: Replace desirability score backgroundColor**

Both occurrences (compact view ~line 155, full-detail view ~line 229) — same replacement:

```tsx
backgroundColor:
  desirabilityScore <= 2
    ? "var(--desirability-low-bg)"
    : desirabilityScore === 3
      ? "var(--desirability-mid-bg)"
      : "var(--desirability-high-bg)",
```

**Step 4: Verify visually**

```bash
npm run dev
```
Open user calendar in OPEN_FOR_PREFERENCES status, zoom to compact view. Verify:
- Desirability score badge colors unchanged
- Selecting a shift block shows blue border
- Assigned shift shows green border

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx
git commit -m "refactor(ShiftBlockNode): replace hardcoded hex colors with CSS var references"
```

---

## Task 3: Event Status Ambient Theming

**What:** Apply a subtle background tint to the main admin content area that reflects the current event status. Pure CSS — no JS color logic.

**Files:**
- Modify: `app/globals.css` — add `[data-event-status]` CSS overrides
- Modify: `app/admin/shifts/schedule/page.tsx` — apply `data-event-status` attribute to the canvas wrapper div
- Modify: `app/app/calendar/page.tsx` — same for user calendar (if applicable)

**Step 1: Add status CSS variable overrides to globals.css**

In `app/globals.css`, add to `@layer base` (after the `:root` block):

```css
/* Event status ambient theming — applied via data-event-status on page wrappers */
[data-event-status="PLANNING"] {
  --status-bg:     #f8fafc;   /* cool gray — neutral */
  --status-accent: #64748b;
}
[data-event-status="OPEN_FOR_PREFERENCES"] {
  --status-bg:     #f0f9ff;   /* sky tint — action required */
  --status-accent: #0ea5e9;
}
[data-event-status="ASSIGNING"] {
  --status-bg:     #fff7ed;   /* amber tint — in progress */
  --status-accent: #f97316;
}
[data-event-status="FINALIZED"] {
  --status-bg:     #f0fdf4;   /* green tint — locked in */
  --status-accent: #22c55e;
}
[data-event-status="COMPLETED"] {
  --status-bg:     #fafaf9;   /* muted — read-only */
  --status-accent: #a8a29e;
}
```

**Step 2: Apply attribute to the schedule page canvas wrapper**

In `app/admin/shifts/schedule/page.tsx`, find the outer `div` that wraps the `LaneCalendarCanvas`. Add `data-event-status` and `bg-[var(--status-bg)]`:

```tsx
// At top, get status from event context:
const { selectedEvent } = useEventContext(true);

// On the canvas wrapper div:
<div
  data-event-status={selectedEvent?.status ?? undefined}
  className="flex-1 flex flex-col transition-colors duration-500 bg-[var(--status-bg)]"
>
  <LaneCalendarCanvas ... />
</div>
```

The `transition-colors duration-500` makes the background crossfade when status changes.

**Step 3: Apply same attribute to user calendar page**

In `app/app/calendar/page.tsx`, find the outer canvas wrapper:

```tsx
const { selectedEvent } = useEventContext(false);

<div
  data-event-status={selectedEvent?.status ?? undefined}
  className="flex-1 transition-colors duration-500 bg-[var(--status-bg)]"
>
  <LaneCalendarCanvas ... />
</div>
```

**Step 4: Visual verification across all 5 statuses**

Using the dev server and seed data, transition an event through statuses:
- PLANNING → faint gray background
- OPEN_FOR_PREFERENCES → faint sky blue
- ASSIGNING → faint amber
- FINALIZED → faint mint green
- COMPLETED → neutral

The background change should be subtle (these are very light tints) and smooth (500ms crossfade).

**Step 5: Commit**

```bash
git add app/globals.css app/admin/shifts/schedule/page.tsx app/app/calendar/page.tsx
git commit -m "feat(status-theming): ambient CSS background tint driven by event status via data attribute"
```

---

## Task 4: Simplify tailwind.config.ts

**What:** After globals.css `@theme` is the authoritative source, the duplicate color scales in `tailwind.config.ts` become redundant noise. Remove them to prevent future divergence.

**Files:**
- Modify: `tailwind.config.ts`

**Step 1: Remove the duplicate color scales**

In `tailwind.config.ts`, remove the `colors` key from `theme.extend` entirely (primary, secondary, accent, success, error, warning, info, gray). The typography, shadows, and borderRadius extensions can stay.

Keep only the legacy compatibility keys (if still used anywhere):
```ts
colors: {
  // Legacy — keep until confirmed unused:
  "shift-primary": "#0f172a",
  "shift-surface": "#0b1222",
  "shift-border": "#1e293b",
  "shift-accent": "#38bdf8",
  "shift-warn": "#f97316",
}
```

**Step 2: Check for any classes that break**

```bash
npx tsc --noEmit
npm run build 2>&1 | grep -i error
```

Also grep for any hardcoded Tailwind classes referencing removed scales:
```bash
grep -r "bg-secondary\|text-secondary\|border-secondary\|bg-info\|text-info\|bg-warning\|text-warning\|bg-error\|text-error" \
  components/ app/ --include="*.tsx" --include="*.ts"
```

Fix any that reference removed scale classes (unlikely — these scales were rarely used directly).

**Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "chore(tokens): remove duplicate color scales from tailwind.config.ts (now canonical in globals.css @theme)"
```

---

## What This Does NOT Change

- No component reorganization (atoms/molecules/organisms restructure is optional future work)
- No ESLint rule enforcement for token usage (can add later once system is stable)
- No dark mode support (React Flow v12 colorMode support exists but out of scope here)
- No animations/micro-interactions beyond the 500ms status transition
- `ShiftTemplate.color` from DB remains authoritative for shift block colors — this plan adds CSS var aliases for the standard templates only, for reference use
- `tailwind.config.ts` legacy `shift-*` keys are untouched (need a separate audit pass)
- No new components or files beyond optional `lib/hooks/useStatusTheme.ts`

---

## Verification Checklist

After all 4 tasks:

- [ ] `bg-primary-500` renders sky-blue on Header logo
- [ ] `bg-success-*` / `bg-error-*` classes work correctly in forms
- [ ] ShiftBlockNode: assigned-to-me border is success-600 green
- [ ] ShiftBlockNode: selected border is info-700 blue
- [ ] ShiftBlockNode: desirability score badge colors match pre-change
- [ ] Admin schedule canvas shows status-appropriate background tint
- [ ] User calendar canvas shows status-appropriate background tint
- [ ] `npx tsc --noEmit` — no new type errors
- [ ] `npm run build` — clean build

---

**Last Updated:** 2026-02-25
**Scope:** UI tokens + status theming (Phase 1 of UI evolution)
**Follows:** `docs/ARCHITECTURE.md` — three-layer pattern unchanged
