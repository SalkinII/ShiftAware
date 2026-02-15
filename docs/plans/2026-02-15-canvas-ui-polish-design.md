# Design: Canvas UI Polish — Readability at All Zoom Levels

**Date:** 2026-02-15
**Status:** Approved

---

## Problem

At maximum zoom-out the LaneCalendar canvas is nearly unreadable:
- Shift blocks are plain colored bars with no text (the `isMinimal` path renders `null`)
- Day separator at midnight is a 1px semi-transparent line — invisible
- Shift borders (1px rgba(0,0,0,0.1)) disappear at low zoom
- No vertical hour grid makes it hard to correlate shifts with the time ruler
- Day separator label is `text-9xl` (128px), far too large, paints over shifts

## Goal

Make the canvas orderly and readable at every zoom level. A user should be able to see shift boundaries, read shift names, correlate positions with the time ruler, and clearly identify day boundaries — without zooming in.

## Technique: Counter-Scaling

React Flow applies `transform: scale(zoom)` to the viewport. Everything inside nodes shrinks with zoom. By applying `transform: scale(1/zoom)` to text containers inside nodes, text stays at a fixed screen-pixel size regardless of zoom. This is standard in map/GIS UIs and React Flow label patterns.

---

## Fix 1: Hour Grid Lines

**What:** Subtle dashed vertical lines at every hour, extending the full canvas height.

**Implementation:** New `HourGridNode` React Flow node type. One node per hour, positioned at `h * PIXELS_PER_HOUR`, full `canvasHeight`. Rendered as a 1px dashed line (`border-left: 1px dashed rgba(0,0,0,0.08)`).

**z-index:** New constant `Z_HOUR_GRID = 0` (same level as lane zones, below separators and shifts).

**Built by:** `useLaneNodes.ts` → new `buildHourGridNodes()` function alongside existing `buildLaneNodes` and `buildDaySeparatorNodes`.

**Registered in:** `LaneCalendarCanvas.tsx` → add `hourGrid: HourGridNode` to `nodeTypes`.

---

## Fix 2: Day Separator Visibility

**Current:** Container 40px wide, line 1px rgba(0,0,0,0.3), label `text-9xl`.

**After:**
1. **Container width:** Reduce `DAY_SEPARATOR_WIDTH` from 40 to 4 (in `constants.ts`)
2. **Line:** 3px wide, `rgba(0,0,0,0.6)` — visible at every zoom
3. **Label:** Counter-scaled text (12px screen size), `font-semibold`, positioned above lanes with a semi-transparent white background pill for contrast. Uses `transform: scale(${1/zoom})` with `transformOrigin: "left bottom"`.

**File:** `DaySeparatorNode.tsx` — needs `useViewport()` for zoom access.

---

## Fix 3: Shift Block Delineation

**Current border:** `1px solid rgba(0,0,0,0.1)` — invisible at low zoom.

**After:** `2px solid` with a darkened variant of the shift color. Use CSS `color-mix(in srgb, ${color} 70%, black)` for the border color. This produces clear edges that harmonize with the shift's own color at every zoom level.

**File:** `ShiftBlockNode.tsx` — modify the border style.

---

## Fix 4: Shift Content at All Zoom Levels

**Current behavior by zoom:**
- `zoom < 0.3` (isMinimal): renders `null` — blank colored bar
- `0.3 ≤ zoom < 0.7` (isCompact): template name only
- `zoom ≥ 0.7` (full): name + times + count

**After — all tiers use counter-scaled text containers:**

### Minimal (zoom < 0.3)
Instead of blank, show template name in a counter-scaled container. Single line, white text, truncated. Uses `transform: scale(${1/zoom})` with `transformOrigin: "left center"`. The container width is set to `width * zoom` so the counter-scaled text doesn't overflow the visual node bounds.

### Compact (0.3 ≤ zoom < 0.7)
Keep template name. Add time range underneath: "09:00–17:00". Counter-scale the text container so it stays legible as zoom decreases.

### Full (zoom ≥ 0.7)
No change — text is already large enough to read.

**File:** `ShiftBlockNode.tsx` — modify render paths, add counter-scale wrappers.

---

## Files Affected

| File | Changes |
|------|---------|
| `components/features/LaneCalendar/utils/constants.ts` | Add `Z_HOUR_GRID`, change `DAY_SEPARATOR_WIDTH` from 40 to 4 |
| `components/features/LaneCalendar/nodes/HourGridNode.tsx` | **New** — simple dashed vertical line node |
| `components/features/LaneCalendar/nodes/DaySeparatorNode.tsx` | 3px line, counter-scaled label with background pill |
| `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx` | Darkened border, counter-scaled content for minimal/compact |
| `components/features/LaneCalendar/hooks/useLaneNodes.ts` | Build hour grid nodes |
| `components/features/LaneCalendar/LaneCalendarCanvas.tsx` | Register `hourGrid` in nodeTypes |

## Future

Staffing/occupation display on shift blocks (team member icons, unstaffed indicator) is the next evolution. This design establishes the visual foundation — clear boundaries, readable labels, grid reference — that staffing info will layer on top of.
