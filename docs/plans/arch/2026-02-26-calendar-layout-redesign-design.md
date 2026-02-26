# Calendar Layout Redesign — Design

> **Date:** 2026-02-26
> **Source:** Manual notes + brainstorming session

---

## Overview

Four related improvements to the calendar canvas and surrounding page layout:

1. **Page Layout Reorganization** — templates above canvas, shift details as right-side panel, stats below
2. **Lane Labels Panel** — fixed left strip showing lane names, always visible during horizontal scroll
3. **Semantic Zoom Density** — three tiers of information density in shift nodes
4. **Alignment Audit + Bug Fixes** — fix ruler/grid offset and lane boundary issue

The canvas is shared between admin and user views. Admin-specific controls (template palette, edit panel) are conditionally shown; the canvas component itself is not duplicated.

---

## 1. Page Layout Reorganization

### Target layout (admin schedule `/admin/shifts/schedule`)

```
┌────────────────────────────────────────────────────┐
│  [ Template A ]  [ Template B ]  [ Template C ]  … │  ← TemplatePalette (horizontal row)
├─────────────────────────────────┬──────────────────┤
│                                 │                  │
│  LaneCalendarCanvas             │ ShiftProperties  │
│  (flex-1, min-w-0)              │ Panel            │
│  height: 80vh                   │ w-80             │
│                                 │ glass card       │
│  ← lane labels panel overlays  │ full height      │
│                                 │                  │
├─────────────────────────────────┴──────────────────┤
│  [✓ 3 fully staffed]  [~ 2 partial]  [✗ 1 empty]  │  ← compact stats bar
└────────────────────────────────────────────────────┘
```

When no shift is selected: canvas is `flex-1`, panel is hidden (unmounted or `hidden`).
When shift selected: `flex flex-row` row — canvas `flex-1 min-w-0`, panel `w-80 flex-shrink-0`.

### Template Palette — above canvas

`TemplatePalette` moves from the right column to a horizontal strip above the canvas.
Compact single-row display. Currently renders as a vertical list — needs a horizontal layout
variant (or a `direction="horizontal"` prop added to `TemplatePalette.tsx`).

Admin-only: hidden for user-facing view via the existing `readOnly` prop on
`LaneCalendarCanvas`, or via a separate boolean prop on the page wrapper.

### Shift Properties Panel — beside canvas

`ShiftPropertiesPanel` changes from `absolute right-4 top-4 bottom-4 w-80 z-20` to a
sibling flex element. No z-index needed. The panel receives full canvas height via
`h-full` on its container, matching `LaneCalendarCanvas`'s `height: 80vh`.

Design: glass card with `bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]`,
`border-l border-gray-200`, `overflow-y-auto` for content scrolling, rounded corners
matching the rest of the UI. Consistent with `GlassPanel` component.

### Stats bar — below canvas

Compact single-row bar showing coverage counts (fully staffed / partial / unstaffed).
Replaces the `grid-cols-4` metrics cards that currently appear ABOVE the canvas
in the user calendar page. Below the canvas, same line height as the template row above.

### User calendar page

Same layout pattern, without the template palette row (hidden/removed for `readOnly`
context). Shift click opens the same `ShiftPropertiesPanel` in read-only mode as the
right-side panel (replaces the current full-screen modal).

---

## 2. Lane Labels Panel

### Component: `LaneLabelPanel`

Location: `components/features/LaneCalendar/panels/LaneLabelPanel.tsx`

A React Flow `<Panel position="top-left">` that renders a fixed-width vertical strip
on the left edge of the canvas, showing abbreviated lane names at their vertical
screen positions.

### Key implementation details

```tsx
// Inline styles override React Flow's default panel CSS margin
<Panel position="top-left" style={{ margin: 0, padding: 0 }}>
  <div
    style={{
      position: "relative",
      width: LANE_LABEL_WIDTH,      // 72px
      height: "100vh",
      marginTop: RULER_HEIGHT,      // 28px — start below time ruler
      backgroundColor: "rgba(255,255,255,0.9)",
      backdropFilter: "blur(10px)",
      borderRight: "1px solid #e5e7eb",
    }}
  >
    {lanes.map((lane, index) => {
      const centerY = flowToScreenY((index + 0.5) * LANE_HEIGHT);
      if (centerY < 0 || centerY > canvasHeight) return null;
      return (
        <div
          key={lane.id}
          style={{
            position: "absolute",
            top: centerY,
            transform: "translateY(-50%)",
            left: 0, right: 0,
            textAlign: "center",
            // font: same as TimeRulerPanel
          }}
        >
          {abbreviateLaneName(lane.label)}
        </div>
      );
    })}
  </div>
</Panel>
```

### Lane name abbreviation

`abbreviateLaneName(name: string): string` — takes the first word of the lane label.
Example: `"Mobile North"` → `"Mobile"`, `"Shift Lead"` → `"Lead"`, `"Super"` → `"Super"`.
Strip the common prefix "Mobile" if it creates ambiguity (designer decision — can be
refined after seeing real output).

### Typography

Same font as `TimeRulerPanel`: `text-xs text-gray-500` (12px after ruler font bump).
Left border color accent: the lane's color, applied as a 3px left border on each label
to reinforce color-coding without requiring more width.

### Constants to add

```typescript
export const LANE_LABEL_WIDTH = 72;   // px, left panel width
export const RULER_HEIGHT = 28;       // px, top ruler height
```

---

## 3. Semantic Zoom Density

### Three tiers (replacing current two)

| Threshold | Tier | Content |
|-----------|------|---------|
| `zoom < ZOOM_MINIMAL (0.3)` | **Occupation** | Assigned member names/avatars ONLY |
| `0.3 ≤ zoom < ZOOM_COMPACT (0.7)` | **Core** | Time range + shift name + desirability ★ + count `3/5` + member names |
| `zoom ≥ ZOOM_COMPACT (0.7)` | **Full** | Everything + `"fully staffed / needs N more"` + vote buttons |

All tiers with `zoom < ZOOM_COMPACT` use `scale(1/zoom)` with explicit `width * zoom` /
`SHIFT_NODE_HEIGHT * zoom` dimensions for zoom-independent text rendering.

### OccupationContent (new — Tier 1)

Renders assigned member names/avatars prominently. If no assignments: a dash or
empty indicator. Font: one Tailwind step smaller than current CompactContent:
- Avatar size: `text-xl` (instead of `text-2xl`)
- Member names: `text-2xl font-bold` (instead of `text-3xl`)

Rationale: at this zoom level, time is readable from the ruler, shift type is readable
from the lane label — the node's unique information is WHO is staffed.

### CoreContent (renamed from CompactContent — Tier 2)

Layout priority top-to-bottom:
1. Time range: `HH:mm – HH:mm` (most critical unique info at this zoom)
2. Shift name
3. Desirability ★ + capacity count `3/5`
4. Member names (if space permits)

Font: current CompactContent sizes (`text-2xl`, `text-3xl`). No change.

### Time ruler font

Change `TimeRulerPanel` label from `text-[9px]` to `text-xs` (12px).
Day labels from `text-[10px]` to `text-xs` as well.

Both `TimeRulerPanel` and `LaneLabelPanel` use the same font class.

---

## 4. Alignment Audit + Bug Fixes

### Coordinate system summary (documented invariant)

```
screenX (container-relative) = flowX * zoom + viewport.x
screenY (container-relative) = flowY * zoom + viewport.y
```

This formula is used by `flowToScreenX` / `flowToScreenY` in `useScreenCoordinates`.
It gives coordinates relative to the React Flow **container's** top-left corner (0,0).

Elements that use this formula must be rendered inside a `<Panel position="top-left">`
with `style={{ margin: 0 }}` to ensure the Panel's (0,0) matches the container's (0,0).

### Bug 1: ~5px ruler tick / grid line offset

**Cause:** React Flow's `.react-flow__panel` CSS applies `margin: 15px` by default.
Tailwind's `m-0` class may lose the CSS cascade order battle against React Flow's
imported stylesheet, resulting in a partial margin that offsets the Panel's origin.

**Fix:** Add `style={{ margin: 0, padding: 0 }}` to `<Panel>` components in addition
to (or replacing) Tailwind margin overrides. Inline `style` has the highest CSS
specificity and always wins over class-based styles.

Files affected: `TimeRulerPanel.tsx`, `LaneLabelPanel.tsx` (new)

### Bug 2: Lane background starts after midnight of event's first day

**Cause:** `buildDaySeparatorNodes` in `useLaneNodes.ts` creates a separator for
`startOfDay(eventStart)` which can be before x=0 if `eventStart` is not at midnight.
Lane zones start at x=0 (= eventStart). This creates an orphaned separator before
the lanes, and allows shifts to be dragged into this pre-lane zone.

**Fix A — filter separators:** Skip any separator where `x < 0`:
```typescript
if (x < 0) continue;   // skip separators before timeline start
```

**Fix B — snap constraint:** In `useCanvasActions`, clamp the snapped X to `>= 0`:
```typescript
const snappedX = Math.max(0, snapX(rawX));
```

Both fixes should be applied together.

### Verification checklist

After implementation, manually verify at zoom 0.1, 0.3, 0.5, 1.0, 2.0:

- [ ] Ruler ticks align exactly with hour grid lines (no visible offset)
- [ ] Day separator line aligns with midnight ruler label
- [ ] Snap guide appears exactly at the shift node's snapped position
- [ ] Lane labels are centered in their lane rows
- [ ] No day separator appears before the first lane background
- [ ] Shifts cannot be dragged to negative X (before timeline start)

---

## Affected Files

| File | Change |
|------|--------|
| `app/admin/shifts/schedule/page.tsx` | Layout: template above canvas, stats below, flex-row for canvas+panel |
| `app/app/calendar/page.tsx` | Layout: same pattern without template row; shift click opens side panel |
| `components/features/LaneCalendar/panels/TimeRulerPanel.tsx` | Panel margin fix; font size bump |
| `components/features/LaneCalendar/panels/LaneLabelPanel.tsx` | **New component** |
| `components/features/LaneCalendar/LaneCalendarCanvas.tsx` | Add LaneLabelPanel; remove panel overlay for ShiftPropertiesPanel |
| `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx` | 3-tier zoom logic: add OccupationContent; rename CompactContent → CoreContent |
| `components/features/LaneCalendar/hooks/useLaneNodes.ts` | Filter out x < 0 day separators |
| `components/features/LaneCalendar/hooks/useCanvasActions.ts` | Clamp snapped X to >= 0 |
| `components/features/LaneCalendar/utils/constants.ts` | Add LANE_LABEL_WIDTH, RULER_HEIGHT |
| `components/features/TemplatePalette/TemplatePalette.tsx` | Add horizontal layout variant |
| `docs/DESIGN.md` | Update coordinate system section, add verification checklist |

---

## Non-goals

- No changes to the underlying data model or API
- No changes to the DaySeparatorNode's label (already moved to TimeRulerPanel in commit `0e36d52`)
- No changes to the AlignmentGuides component (already fixed in commit `9d64ca5`)
- No changes to the Properties Panel edit functionality — only layout/positioning changes
