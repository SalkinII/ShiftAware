# DESIGN.md Correction + FRONTEND.md Creation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Correct DESIGN.md to reflect current implementation, and create FRONTEND.md as a canonical frontend pattern reference.

**Architecture:** Two independent edits — DESIGN.md is rewritten in place, FRONTEND.md is created fresh. No code changes. No API changes. Pure documentation. The design doc is at `docs/plans/2026-03-05-design-frontend-docs-design.md`.

**Tech Stack:** Markdown only.

---

## Context

`docs/DESIGN.md` has drifted from the actual codebase. Key errors:
- Template palette described as sidebar with color stripe — it's above canvas, grip handle only
- ShiftBlockNode uses zoom thresholds for content density — it actually uses ResizeObserver width thresholds
- Lane color table uses generic A–F placeholders — the real system is `template.color || getPaletteColor(index)`
- Coordinate system section (§3) belongs in a frontend patterns doc, not visual design

`docs/FRONTEND.md` does not exist. There is no canonical reference for:
- Coordinate system rules
- Component registry (what atoms exist and when to use them)
- Reusability rules ("never build X, use Y")
- Prop conventions

---

## Task 1: Rewrite DESIGN.md §1–2 (Philosophy + Token System)

**Files:**
- Modify: `docs/DESIGN.md`

**Step 1: Update the header date**

Change:
```
> Last updated: 2026-02-28
```
To:
```
> Last updated: 2026-03-05
```

**Step 2: Rewrite §2 Lane Colors section**

Replace the entire Lane Colors subsection (the table with A/B/C/D/E/F rows) with:

```markdown
### Lane Color Resolution

Lane color flows from one source: `deriveLanesFromTemplates()` in `lib/types/lane.ts`.

**Resolution order:**
1. `template.color` — hex value pinned in DB via the Setup page (TemplateManager)
2. `getPaletteColor(index)` — cycling 12-color palette from `lib/utils/palette.ts` (fallback when no color is set)

The resolved color lives on `LaneConfig.color` and is the single source of truth for all downstream rendering. Components receive `color: string` as a prop and never resolve it themselves.

### Base Palette (12 entries in `globals.css @theme`)

| Index | Hex | Tailwind equivalent |
|-------|-----|---------------------|
| 0 | `#0ea5e9` | sky-500 |
| 1 | `#22c55e` | green-500 |
| 2 | `#f59e0b` | amber-500 |
| 3 | `#ef4444` | red-500 |
| 4 | `#8b5cf6` | violet-500 |
| 5 | `#ec4899` | pink-500 |
| 6 | `#06b6d4` | cyan-500 |
| 7 | `#84cc16` | lime-500 |
| 8 | `#f97316` | orange-500 |
| 9 | `#6366f1` | indigo-500 |
| 10 | `#14b8a6` | teal-500 |
| 11 | `#a855f7` | purple-500 |

To extend the palette: add entries to `LANE_PALETTE` in `lib/utils/palette.ts`.
```

**Step 3: Verify**

Open `lib/utils/palette.ts` and confirm the 12 colors match the table above before committing.

**Step 4: Commit**

```bash
git add docs/DESIGN.md
git commit -m "docs(design): rewrite lane color section with resolution chain pattern"
```

---

## Task 2: Remove §3 Coordinate System from DESIGN.md

**Files:**
- Modify: `docs/DESIGN.md`

**Step 1: Delete the entire §3 section**

Remove everything from `## 3. Coordinate System Architecture` through the end of the Manual Verification Checklist (Phase A and Phase B checkboxes). This is roughly lines 58–165 in the current file.

Do not delete anything from `## 4. Component Patterns` onward.

**Step 2: Renumber remaining sections**

After deletion, renumber:
- Old §4 → new §3 (Component Patterns)
- Old §5 → new §4 (Atom Components)
- Old §6 → new §5 (Typography Hierarchy)
- Old §7 → new §6 (Interaction Patterns)
- Old §8 → new §7 (Color Scale Reference)
- Old §9 → new §8 (Quick Reference)

**Step 3: Commit**

```bash
git add docs/DESIGN.md
git commit -m "docs(design): remove coordinate system section (moves to FRONTEND.md)"
```

---

## Task 3: Fix Component Patterns section in DESIGN.md

**Files:**
- Modify: `docs/DESIGN.md`

**Step 1: Rewrite Template Palette Items subsection**

Replace the Template Palette Items subsection with:

```markdown
### Template Palette Items

Horizontal strip **above** the canvas. Items are draggable chips with a grip handle. No color stripe.

**Two render modes:**

Full item (vertical layout):
```
┌─────────────────────────────────────┐
│ ⠿ Template Name                     │
│   Xh (start time)                   │
└─────────────────────────────────────┘
```

Compact chip (`compact` prop — used in horizontal strip):
```
┌────────────────────┐
│ ⠿ Template Name    │
└────────────────────┘
```

**Key Classes:**
```css
group flex items-center gap-2 px-3 py-1.5 rounded-lg
bg-white hover:bg-gray-50 cursor-grab active:cursor-grabbing
border border-transparent hover:border-gray-200 transition-colors
```

Grip icon: always visible (`GripVertical` from lucide-react).
```

**Step 2: Rewrite ShiftBlockNode density subsection**

Replace the density section (CompactContent/DetailedContent zoom model) with:

```markdown
### Shift Visualization (Glass Card with Width-Based Density)

**ShiftBlockNode** — glass card with colored left border. Content density responds to the card's rendered pixel dimensions via `ResizeObserver`, not zoom level.

```
┌──┬──────────────────────────────┐
│  │ Template Name    08:00–16:00 │  ← Row 1: name + time (mW ≥ W_NAMES/W_TIME)
│  │ ★★★              3/5         │  ← Row 2: stars + count (mH ≥ H_ROW2)
│  │ 😀 Alice  😀 Bob             │  ← Row 3: avatars + names (mH ≥ H_ROW3)
└──┴──────────────────────────────┘
```

**Density thresholds** (from `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`):

| Constant | Value | Content shown |
|----------|-------|---------------|
| `W_NAMES` | 40px | Template name (Row 1) |
| `W_TIME` | 100px | Time range added to Row 1 |
| `W_STARS` | 130px | Desirability stars in Row 2 |
| `H_ROW2` | 20px | Row 2 visible (stars + votes + count) |
| `H_ROW3` | 38px | Row 3 visible (avatars + names) |

**Note:** `ZOOM_COMPACT` / `ZOOM_MINIMAL` constants apply to `TimeRulerPanel` tick density and date label format — not to shift card content.

**Key Classes:**
```css
bg-white/80 backdrop-blur-sm border-l-4
shadow-[var(--shift-shadow)] hover:shadow-[var(--shift-shadow-hover)]
```
```

**Step 3: Fix Algorithm Results Modal gradient**

Find:
```
bg-gradient-to-r from-blue-600 to-purple-600 (header)
```
Replace with:
```
bg-gradient-to-r from-primary-500 to-primary-600 (header)
```

**Step 4: Commit**

```bash
git add docs/DESIGN.md
git commit -m "docs(design): fix template palette, ShiftBlockNode density, modal gradient"
```

---

## Task 4: Add Feature Components section + fix Quick Reference in DESIGN.md

**Files:**
- Modify: `docs/DESIGN.md`

**Step 1: Add §5 Feature Components section**

Insert a new section after the Atom Components table (after the `---` separator that follows the atom table):

```markdown
## 5. Feature Components

Domain-level components in `components/features/`. Before building a new feature component, check this list.

| Component | Purpose | Mounted in |
|-----------|---------|------------|
| `LaneCalendar/LaneCalendarCanvas` | React Flow schedule canvas (editable + read-only) | Admin schedule, User calendar |
| `TemplatePalette` | Drag source for creating shifts from templates | Admin schedule (above canvas) |
| `LaneCalendar/sidebar/ShiftPropertiesPanel` | Edit and view shift details, manage assignments | Admin schedule sidebar |
| `AlgorithmResultsModal` | Display algorithm preview results | Admin team (DistributionSettings) |
| `SwapInterface` | Swap request workflow with conflict detection | User calendar |
| `AvailabilityHeatmap` | Member availability matrix | Admin team |
| `ConflictWizard` | Conflict detection and resolution flow | Admin team |
| `Identity/ProfileDetailCard` | Read-only member profile card (avatar, alias, attributes) | Canvas sidebar, team views |
| `ShiftPropertiesPanel/ShiftPreferencePanel` | User preference voting (WANT/DONT_WANT) on a shift | User calendar |
```

**Step 2: Rewrite Quick Reference — Adding a New Lane Type**

Replace the current "Adding a New Lane Type" subsection with:

```markdown
### Adding a New Lane Type

All color is derived from the template, not from CSS. Follow this flow:

1. **Create the template** via Setup → TemplateManager (sets name, type, capacity, duration in DB).
2. **Optionally pin a color** — set `template.color` (hex string) in the DB if this template needs a fixed visual identity.
3. **Color resolves automatically** — `deriveLanesFromTemplates()` computes `LaneConfig.color` as `template.color || getPaletteColor(index)`.
4. **Color flows as a prop** to: `LaneZoneNode` (background tint), `ShiftBlockNode` (left border), `TemplatePalette` items.
5. **No CSS changes required.** Do not add new `--lane-*` tokens unless you need a CSS variable accessible outside of component props.
```

**Step 3: Update Resources section**

Replace:
```markdown
- **Design Evolution Plan:** `docs/plans/2026-02-25-ui-design-evolution.md`
```
With:
```markdown
- **Frontend Patterns:** `docs/FRONTEND.md`
```

**Step 4: Commit**

```bash
git add docs/DESIGN.md
git commit -m "docs(design): add feature components section, rewrite lane color quick reference"
```

---

## Task 5: Create FRONTEND.md

**Files:**
- Create: `docs/FRONTEND.md`

**Step 1: Create the file with this content**

```markdown
# ShiftAware Frontend Patterns

> Reference for coordinate system rules, component registry, reusability rules, and prop conventions.
> Read this before adding a new component or modifying canvas rendering.
>
> Last updated: 2026-03-05

---

## 1. Coordinate System Architecture

> **Critical:** All React Flow positioning must use a single, consistent coordinate transformation model.

### Three Coordinate Spaces

| Space | Description | Positioning | Transform |
|-------|-------------|-------------|-----------|
| **Flow Space** | Logical coordinates within React Flow canvas | Node `position` prop | Automatic (React Flow handles) |
| **Viewport Space** | Visible canvas area with pan/zoom applied | — | Zoom + pan (React Flow) |
| **Screen Space** | Physical pixel positions in the browser window | Panel overlays | Manual via `useScreenCoordinates` hook |

### Rules (MUST FOLLOW)

1. **Node-positioned elements** → Always use React Flow's automatic transforms
   - Position via `position: { x, y }` prop on the node
   - Never manually scale or transform
   - Examples: `LaneZoneNode`, `DaySeparatorNode`, `ShiftBlockNode`, `HourGridNode`

2. **Panel-based overlays** → Use `useScreenCoordinates` hook ONLY
   - Horizontal positioning: `flowToScreenX(flowX)`
   - Vertical positioning: `flowToScreenY(flowY)`
   - Never apply manual viewport math inline
   - Examples: `TimeRulerPanel`, `LaneLabelPanel`, `AlignmentGuides`

3. **Never mix** → A single element cannot use both automatic + manual transforms
   - ✗ Node positioned by React Flow + manual viewport math = misalignment
   - ✓ Node positioned by React Flow OR Panel using `flowToScreenX()` = correct

### Coordinate Transform Formula

```
screenX = (flowX * zoom) + viewportX
screenY = (flowY * zoom) + viewportY
```

Encapsulated in `useScreenCoordinates()` — `components/features/LaneCalendar/hooks/useScreenCoordinates.ts`.

The hook exposes: `flowToScreenX`, `flowToScreenY`, `zoom`, `viewportX`, `viewportY`.

### Zoom Constants

From `components/features/LaneCalendar/utils/constants.ts`:

| Constant | Value | Used for |
|----------|-------|----------|
| `ZOOM_MINIMAL` | 0.3 | `TimeRulerPanel`: short date labels below this zoom |
| `ZOOM_COMPACT` | 0.7 | `TimeRulerPanel`: hide 15-min ticks below this zoom |

These constants apply to **ruler density only**. Shift card content density uses `ResizeObserver` width thresholds — see DESIGN.md §3.

### Affected Files

| File | Role |
|------|------|
| `components/features/LaneCalendar/utils/coordinates.ts` | Coordinate math utilities |
| `components/features/LaneCalendar/hooks/useScreenCoordinates.ts` | Viewport hook |
| `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx` | Node (React Flow positions) |
| `components/features/LaneCalendar/nodes/LaneZoneNode.tsx` | Node (React Flow positions) |
| `components/features/LaneCalendar/panels/TimeRulerPanel.tsx` | Panel (uses `flowToScreenX`) |
| `components/features/LaneCalendar/panels/LaneLabelPanel.tsx` | Panel (uses `flowToScreenY`) |
| `components/features/LaneCalendar/LaneCalendarCanvas.tsx` | `AlignmentGuides` (uses `flowToScreenX`) |

---

## 2. Component Registry

### Atoms (`components/ui/`)

Before building a new visual element, check this table. If something fits, use it. If you extend an existing atom, update this table.

| Component | Purpose | Use when |
|-----------|---------|----------|
| `ColorStripe` | Vertical lane color bar | Any element showing lane or template color identity |
| `AvatarStack` | Overlapping gradient avatars | Displaying multiple assigned members |
| `DesirabilityBadge` | Score pill with star icon | Showing shift desirability score |
| `StatusBadge` | Event lifecycle status indicator | Header or status display; pulses on active statuses |
| `GlassPanel` | Frosted glass container | Sidebars, overlays, property panels |
| `SectionLabel` | Uppercase section header | Grouping content within a panel |
| `ProgressBar` | Horizontal fill bar | Staffing coverage, preference satisfaction |

For new panels, use the `GlassPanel` structure from DESIGN.md §8.

### Feature Components (`components/features/`)

| Component | Purpose | Admin | User |
|-----------|---------|-------|------|
| `LaneCalendar/LaneCalendarCanvas` | React Flow schedule canvas | ✓ (editable) | ✓ (readOnly) |
| `TemplatePalette` | Drag source for creating shifts | ✓ | — |
| `LaneCalendar/sidebar/ShiftPropertiesPanel` | Edit shift, manage assignments | ✓ | — |
| `AlgorithmResultsModal` | Display algorithm preview results | ✓ | — |
| `SwapInterface` | Swap request workflow | — | ✓ |
| `AvailabilityHeatmap` | Member availability matrix | ✓ | — |
| `ConflictWizard` | Conflict detection and resolution | ✓ | — |
| `Identity/ProfileDetailCard` | Read-only member profile card | ✓ | ✓ |
| `ShiftPropertiesPanel/ShiftPreferencePanel` | Preference voting on a shift | — | ✓ |

---

## 3. Reusability Rules

These rules address recurring patterns where ad-hoc solutions have caused duplication or inconsistency.

### Color resolution

- **Never** resolve lane or shift color inside a component.
- **Always** accept `color: string` as a prop — a resolved hex value from `deriveLanesFromTemplates()`.
- **Never** import `getLaneColor()` or `getPaletteColor()` in a component. These are internal to `lib/types/lane.ts` and `lib/utils/palette.ts`.

### Shift display

- **Never** inline shift type labels, time formatting, or coverage strings.
- **Always** use `getShiftDisplayInfo()` from `lib/utils/shift-display.ts` for display-layer shift data.

### Glass panels

- **Never** build a frosted overlay panel from scratch.
- **Always** use `GlassPanel` with the standard header/content/footer structure (DESIGN.md §8).

### Avatar and member display

- **Never** build a new avatar element or member name display.
- **Always** use `AvatarStack` for multiple members, `ProfileDetailCard` for a single member's full info.

### Canvas sidebar panels

- When adding a new panel to the canvas sidebar, follow `ShiftPropertiesPanel` as the canonical structure.

---

## 4. Prop Conventions

These prop patterns must be consistent across all shared and feature components.

| Prop | Type | Rule |
|------|------|------|
| `color` | `string` | Always a resolved hex string. Never a CSS class, Tailwind token, or enum value. |
| `readOnly` | `boolean?` | Standard gate for disabling interactions in shared components (e.g. `LaneCalendarCanvas`, `ShiftBlockNode`). |
| `onClose` | `() => void` | Panels always receive this. Never manage close state internally inside a panel. |
| `eventStatus` | `EventStatus` | Passed down from page level. Components never fetch event status themselves. |
| `eventId` | `string` | Always explicit. Only use `useEventContext` when a component is deeply nested and prop-drilling is impractical. |

---

## Resources

- **Visual tokens and aesthetics:** `docs/DESIGN.md`
- **Backend three-layer architecture:** `docs/ARCHITECTURE.md`
- **API endpoint reference:** `docs/API.md`
- **Algorithm engine:** `docs/ALGORITHM.md`
```

**Step 2: Verify the file exists**

```bash
ls docs/FRONTEND.md
```

Expected: file listed.

**Step 3: Commit**

```bash
git add docs/FRONTEND.md
git commit -m "docs: create FRONTEND.md with coordinate system, component registry, and reusability rules"
```

---

## Task 6: Update PROJECT-OVERVIEW.md documentation map

**Files:**
- Modify: `docs/PROJECT-OVERVIEW.md`

**Step 1: Add FRONTEND.md to the documentation map table**

Find the table row for DESIGN.md and insert a new row after it:

```markdown
| [FRONTEND.md](./FRONTEND.md) | Frontend patterns reference | [Coordinate System](#), [Component Registry](#), [Reusability Rules](#), [Prop Conventions](#) |
```

**Step 2: Add FRONTEND.md to the Workflow Quick Reference**

Find the "Change a design token" row and add after it:

```markdown
| Add a new UI component | [FRONTEND.md — Component Registry](./FRONTEND.md) |
| Understand component reuse rules | [FRONTEND.md — Reusability Rules](./FRONTEND.md) |
```

**Step 3: Commit**

```bash
git add docs/PROJECT-OVERVIEW.md
git commit -m "docs: add FRONTEND.md to project overview documentation map"
```

---

## Verification

After all tasks complete:

1. Open `docs/DESIGN.md` — confirm no §3 Coordinate System section, no checklist.
2. Open `docs/FRONTEND.md` — confirm it exists and renders cleanly.
3. Search for any remaining references to the old zoom-based ShiftBlockNode model in docs:
   ```bash
   grep -r "CompactContent\|DetailedContent\|zoom < ZOOM_COMPACT" docs/DESIGN.md
   ```
   Expected: no matches.
4. Search for any remaining A–F lane color table rows in DESIGN.md:
   ```bash
   grep "| A |" docs/DESIGN.md
   ```
   Expected: no matches.
