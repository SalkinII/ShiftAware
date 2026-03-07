# Design: DESIGN.md Correction + FRONTEND.md Creation

> **Approved design document. Implementation plan follows.**
>
> Date: 2026-03-05

---

## Overview

Two coordinated documentation changes:

1. **DESIGN.md** — corrected and trimmed to be a pure visual reference (tokens, colors, typography, component aesthetics). Removes the coordinate system section and the manual verification checklist. Fixes factual errors accumulated since v3.5.

2. **FRONTEND.md** (new) — a focused frontend pattern reference for both human and AI readers. Covers coordinate system rules, component registry, reusability rules, and prop conventions. The canonical document to point at when prompting "respect the component patterns".

---

## DESIGN.md: What Changes

### Removed

- **§3 Coordinate System Architecture** (entire section) — moves to FRONTEND.md §1
- **Manual Verification Checklist** (bottom of §3) — removed entirely; belongs in test plans, not design docs

### Fixed: §2 Lane Colors

Replace the static A–F token table with a principled description of the color resolution chain:

> Lane color flows from one source: `deriveLanesFromTemplates()` in `lib/types/lane.ts`.
>
> Resolution order: `template.color` (pinned in DB via Setup) → `getPaletteColor(index)` (cycling 12-color palette in `lib/utils/palette.ts`).
>
> The resolved color lives on `LaneConfig.color` and is the single source of truth for all downstream rendering.

The token table is kept for the **base palette entries** in `globals.css @theme`, framed as: "these are the 12 palette entries; extend here if a wider palette is needed."

Named semantic tokens (`--lane-mobile-north`, etc.) are documented as optional — only needed if a template requires a pinned CSS identity rather than a DB-stored hex color.

### Fixed: §4 Template Palette Items

Rewritten to match current implementation:

- Horizontal strip **above** the canvas (not in sidebar)
- Items use `GripVertical` icon; no `ColorStripe` (removed in v3.5b)
- Two render modes: full item (vertical layout sidebar) and compact chip (`compact` prop, used in horizontal strip)

### Fixed: §4 ShiftBlockNode density

Replace the zoom-threshold model (`zoom < ZOOM_COMPACT` → CompactContent) with the current width-based `ResizeObserver` model:

| Threshold constant | Value | Condition |
|--------------------|-------|-----------|
| `W_NAMES` | 40px | Show template name |
| `W_TIME` | 100px | Add time range |
| `W_STARS` | 130px | Add desirability stars |
| `H_ROW2` | 20px | Show second row (stars + votes) |
| `H_ROW3` | 38px | Show third row (avatars + names) |

Note: `ZOOM_COMPACT` / `ZOOM_MINIMAL` still apply — to `TimeRulerPanel` tick density and date label format, **not** to shift card content density.

### Fixed: §4 Algorithm Results Modal

Gradient header: `from-primary-500 to-primary-600` (not `from-blue-600 to-purple-600`).

### Fixed: §5 Feature Components (new section)

Add a short section listing all feature-level components with purpose and mount location:

| Component | Purpose | Mounted in |
|-----------|---------|------------|
| `LaneCalendar/LaneCalendarCanvas` | React Flow schedule canvas | Admin schedule, User calendar |
| `TemplatePalette` | Drag source for creating shifts | Admin schedule (above canvas) |
| `LaneCalendar/sidebar/ShiftPropertiesPanel` | Edit/view shift details | Admin schedule sidebar |
| `AlgorithmResultsModal` | Preview algorithm results | Admin team (DistributionSettings) |
| `SwapInterface` | Swap request workflow | User calendar |
| `AvailabilityHeatmap` | Member availability matrix | Admin team |
| `ConflictWizard` | Conflict detection and resolution | Admin team |
| `Identity/ProfileDetailCard` | Read-only member profile card | Canvas sidebar, team views |
| `ShiftPropertiesPanel/ShiftPreferencePanel` | User preference voting on a shift | User calendar |

### Fixed: §9 Quick Reference — Adding a New Lane Type

Replace two-option guidance with single canonical color inheritance flow:

1. Create template via Setup (DB) — name, type, capacity, duration.
2. Optionally set `template.color` (hex) in DB for a fixed color identity.
3. `deriveLanesFromTemplates()` resolves `LaneConfig.color`: `template.color || getPaletteColor(index)`.
4. `LaneConfig.color` flows as a prop to: `LaneZoneNode` (background tint), `ShiftBlockNode` (left border), `TemplatePalette` items.
5. **No CSS changes required.** Components never resolve color themselves.

### Updated

- "Last Updated" date → 2026-03-05
- Resources section: remove "Design Evolution Plan" (plan doc, not a stable reference)
- Resources section: add link to new `docs/FRONTEND.md`

---

## FRONTEND.md: Structure (new file)

`docs/FRONTEND.md`

### §1 Coordinate System

*Moved from DESIGN.md §3, with corrections.*

Three coordinate spaces (Flow, Viewport, Screen), the two rules (node-positioned vs panel-overlay), and the transform formula `screenX = (flowX * zoom) + viewportX`.

**Corrections from original:**
- Add `LaneLabelPanel` to affected files list (uses `flowToScreenY`)
- Clarify: `ZOOM_COMPACT` / `ZOOM_MINIMAL` are for `TimeRulerPanel` tick density, not `ShiftBlockNode` content density
- `useScreenCoordinates` exposes: `flowToScreenX`, `flowToScreenY`, `zoom`, `viewportX`, `viewportY`

### §2 Component Registry

**Atoms (`components/ui/`):**

| Component | Purpose | Use when |
|-----------|---------|----------|
| `ColorStripe` | Vertical lane color bar | Any element showing lane/template identity |
| `AvatarStack` | Overlapping gradient avatars | Displaying multiple assigned members |
| `DesirabilityBadge` | Score pill with star | Showing shift desirability score |
| `StatusBadge` | Event lifecycle status indicator | Header/status display with pulse on active statuses |
| `GlassPanel` | Frosted glass container | Sidebars, overlays, property panels |
| `SectionLabel` | Uppercase section header | Grouping content within a panel |
| `ProgressBar` | Horizontal fill bar | Staffing coverage, preference progress |

Rule stated explicitly:

> Before building a new visual element, check this table. If something fits, use it. If you extend an existing atom, update this table.

**Feature components (`components/features/`):**

Same table as DESIGN.md §5, with the addition of which are shared between admin/user views vs admin-only.

### §3 Reusability Rules

Explicit directive statements — the rules that have caused drift in the past:

- **Color resolution:** Never resolve lane/shift color in a component. Accept `color: string` as a prop, resolved upstream by `deriveLanesFromTemplates()`. Do not import `getLaneColor()` or `getPaletteColor()` in components.
- **Shift display:** Never inline shift type labels or formatting. Use `getShiftDisplayInfo()` from `lib/utils/shift-display.ts`.
- **Glass panels:** Never build a new frosted panel from scratch. Use `GlassPanel` with the standard header/content/footer structure (see DESIGN.md §9).
- **Avatars:** Never build a new avatar or member display element. Use `AvatarStack` or `ProfileDetailCard`.
- **New canvas sidebar panels:** Follow `ShiftPropertiesPanel` as the canonical structure example.

### §4 Prop Conventions

Recurring prop patterns that must be consistent across components:

| Prop | Type | Convention |
|------|------|------------|
| `color` | `string` | Always a resolved hex string. Never a CSS class, token name, or enum value. |
| `readOnly` | `boolean?` | Standard gate for disabling interactions in shared components. |
| `onClose` | `() => void` | Panels always receive this. Never manage close state internally. |
| `eventStatus` | `EventStatus` | Passed from page level. Components never fetch event status themselves. |
| `eventId` | `string` | Always explicit. Components never infer event from context unless using `useEventContext`. |

---

## Document Map Update

`docs/PROJECT-OVERVIEW.md` documentation table should be updated to include `FRONTEND.md`.
