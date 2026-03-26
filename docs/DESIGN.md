# ShiftAware Design System

> **Visual language reference for the "Command Center" aesthetic.**
>
> Last updated: 2026-03-05

---

## 1. Design Philosophy

**Visual Metaphor:** Air Traffic Control meets Festival Poster Art

- **Admins** see dense, data-rich interfaces (command center)
- **Users** see clean, glanceable schedules (festival wristband feel)
- **Shared DNA:** Bold color-coded lanes, high contrast, status-driven ambient theming

### Key Principles

| Principle                | Implementation                                                  |
| ------------------------ | --------------------------------------------------------------- |
| Semantic Color Coding    | Every lane type has persistent color identity                   |
| Progressive Disclosure   | Dense admin data reveals progressively; user views stay minimal |
| Status-Driven Chromatics | Event lifecycle stages have distinct ambient color shifts       |
| Motion as Feedback       | State changes have purposeful animation (500ms transitions)     |

---

## 2. Token System

All tokens defined in `app/globals.css` via Tailwind v4 `@theme` and `@layer base`.

### Lane Color Resolution

Lane color flows from one source: `deriveLanesFromTemplates()` in `lib/types/lane.ts`.

**Resolution order:**

1. `template.color` — hex value pinned in DB via the Setup page (TemplateManager)
2. `getPaletteColor(index)` — cycling 12-color palette from `lib/utils/palette.ts` (fallback when no color is set)

The resolved color lives on `LaneConfig.color` and is the single source of truth for all downstream rendering. Components receive `color: string` as a prop and never resolve it themselves.

### Base Palette (12 entries in `globals.css @theme`)

| Index | Hex       | Tailwind equivalent |
| ----- | --------- | ------------------- |
| 0     | `#0ea5e9` | sky-500             |
| 1     | `#22c55e` | green-500           |
| 2     | `#f59e0b` | amber-500           |
| 3     | `#ef4444` | red-500             |
| 4     | `#8b5cf6` | violet-500          |
| 5     | `#ec4899` | pink-500            |
| 6     | `#06b6d4` | cyan-500            |
| 7     | `#84cc16` | lime-500            |
| 8     | `#f97316` | orange-500          |
| 9     | `#6366f1` | indigo-500          |
| 10    | `#14b8a6` | teal-500            |
| 11    | `#a855f7` | purple-500          |

To extend the palette: add entries to `LANE_PALETTE` in `lib/utils/palette.ts`.

### Status Ambient Theming

Applied via `data-event-status` attribute on page wrappers:

| Status               | Background | Accent    | Pulse |
| -------------------- | ---------- | --------- | ----- |
| PLANNING             | `#f8fafc`  | `#64748b` | No    |
| OPEN_FOR_PREFERENCES | `#f0f9ff`  | `#0ea5e9` | Yes   |
| ASSIGNING            | `#fff7ed`  | `#f97316` | Yes   |
| FINALIZED            | `#f0fdf4`  | `#22c55e` | No    |
| COMPLETED            | `#fafaf9`  | `#a8a29e` | No    |

CSS usage: `var(--status-bg)`, `var(--status-accent)`

### Effect Tokens

| Token                  | Value                                   | Usage                 |
| ---------------------- | --------------------------------------- | --------------------- |
| `--shift-shadow`       | `0 2px 4px -1px rgba(0,0,0,0.1), ...`   | Shift card rest state |
| `--shift-shadow-hover` | `0 4px 6px -1px rgba(0,0,0,0.1), ...`   | Shift card hover      |
| `--glass-bg`           | `rgba(255, 255, 255, 0.9)`              | Panel backgrounds     |
| `--glass-blur`         | `10px`                                  | Backdrop blur amount  |
| `--lane-stripe`        | `repeating-linear-gradient(45deg, ...)` | Lane zone pattern     |

---

## 3. Component Patterns

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

### Shift Visualization (Glass Card with Width-Based Density)

**ShiftBlockNode** — glass card with colored left border. Content density responds to the card's rendered pixel dimensions via `ResizeObserver`, not zoom level.

```
┌──┬──────────────────────────────┐
│  │ Template Name    08:00–16:00 │  ← Row 1: name + time (mW ≥ W_NAMES/W_TIME)
│  │ +++              3/5         │  ← Row 2: token + count (mH ≥ H_ROW2)
│  │ 😀 Alice  😀 Bob             │  ← Row 3: avatars + names (mH ≥ H_ROW3)
└──┴──────────────────────────────┘
```

**Density thresholds** (from `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`):

| Constant  | Value | Content shown                         |
| --------- | ----- | ------------------------------------- |
| `W_NAMES` | 40px  | Template name (Row 1)                 |
| `W_TIME`  | 100px | Time range added to Row 1             |
| `W_token` | 130px | Desirability token in Row 2           |
| `H_ROW2`  | 20px  | Row 2 visible (token + votes + count) |
| `H_ROW3`  | 38px  | Row 3 visible (avatars + names)       |

**Note:** `ZOOM_COMPACT` / `ZOOM_MINIMAL` constants apply to `TimeRulerPanel` tick density and date label format — not to shift card content.

**Key Classes:**

```css
bg-white/80 backdrop-blur-sm border-l-4
shadow-[var(--shift-shadow)] hover:shadow-[var(--shift-shadow-hover)]
```

### Properties Panel

**Structure:** Glass panel with sections.

- Header: Title + close button
- Shift Info Card: Colored background (sky-50)
- Team Preference: Progress bar + counts
- Assignments: List with hover-reveal actions
- Footer: Save (primary) + Delete (ghost red)

**Key Classes:**

```css
bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]
```

### Lane Backgrounds

**Structure:** Tinted zone with diagonal stripe pattern.

**Key Styles:**

```css
backgroundColor: ${color}1A   /* 10% opacity tint */
backgroundImage: var(--lane-stripe)
```

### Algorithm Results Modal

**Structure:** Full-screen modal with gradient header and three content sections.

- Summary bar: total assignments count, violation count, preference satisfaction %
- Violations list: severity badges (hard/soft), constraint type, message
- Per-shift breakdown: grouped by template type, alias + score per member
- Member coverage: each member → shift count, average score

**Key classes:**
bg-gradient-to-r from-primary-500 to-primary-600 (header)
Severity badges reuse ConflictWizard badge pattern

**Triggered by:** "Preview" button in DistributionSettings, only in ASSIGNING status
**File:** components/features/AlgorithmResultsModal.tsx

### User List View (Calendar)

**Structure:** Two-section list in user calendar sidebar.

Section 1 — My Assignments:

- Cards: template name, date, time, lane color stripe, assignment type badge (ALGORITHM / MANUAL)
- Action: "Request Swap" (when event is FINALIZED)
- Sort: chronological

Section 2 — My Preferences:

- Cards: WANT/DONT_WANT status, shift name, date
- Fulfilled indicator: green check (assigned to a WANT shift) / red X (assigned to a DONT_WANT shift)
- Sort: chronological

**File:** app/app/calendar/components/MyShiftsList.tsx

---

## 4. Atom Components

| Component           | File                                  | Purpose                      |
| ------------------- | ------------------------------------- | ---------------------------- |
| `ColorStripe`       | `components/ui/ColorStripe.tsx`       | Vertical lane color bar      |
| `AvatarStack`       | `components/ui/AvatarStack.tsx`       | Overlapping gradient avatars |
| `DesirabilityBadge` | `components/ui/DesirabilityBadge.tsx` | Score pill with star         |
| `StatusBadge`       | `components/ui/StatusBadge.tsx`       | Header status indicator      |
| `GlassPanel`        | `components/ui/GlassPanel.tsx`        | Frosted glass container      |
| `SectionLabel`      | `components/ui/SectionLabel.tsx`      | Uppercase section header     |
| `ProgressBar`       | `components/ui/ProgressBar.tsx`       | Horizontal fill bar          |

---

## 5. Feature Components

Domain-level components in `components/features/`. Before building a new feature component, check this list.

| Component                                   | Purpose                                                   | Mounted in                        |
| ------------------------------------------- | --------------------------------------------------------- | --------------------------------- |
| `LaneCalendar/LaneCalendarCanvas`           | React Flow schedule canvas (editable + read-only)         | Admin schedule, User calendar     |
| `TemplatePalette`                           | Drag source for creating shifts from templates            | Admin schedule (above canvas)     |
| `LaneCalendar/sidebar/ShiftPropertiesPanel` | Edit and view shift details, manage assignments           | Admin schedule sidebar            |
| `AlgorithmResultsModal`                     | Display algorithm preview results                         | Admin team (DistributionSettings) |
| `SwapInterface`                             | Swap request workflow with conflict detection             | User calendar                     |
| `AvailabilityHeatmap`                       | Member availability matrix                                | Admin team                        |
| `ConflictWizard`                            | Conflict detection and resolution flow                    | Admin team                        |
| `Identity/ProfileDetailCard`                | Read-only member profile card (avatar, alias, attributes) | Canvas sidebar, team views        |
| `ShiftPropertiesPanel/ShiftPreferencePanel` | User preference voting (WANT/DONT_WANT) on a shift        | User calendar                     |

---

## 6. Typography Hierarchy

| Element       | Classes                                                        |
| ------------- | -------------------------------------------------------------- |
| Section label | `text-xs font-semibold text-gray-500 uppercase tracking-wider` |
| Card title    | `text-sm font-semibold text-gray-900`                          |
| Time/subtitle | `text-xs text-gray-500`                                        |
| Footer hint   | `text-xs text-gray-400`                                        |
| Badge         | `text-xs font-medium`                                          |

---

## 7. Interaction Patterns

### Hover States

| Pattern        | Implementation                                                          |
| -------------- | ----------------------------------------------------------------------- |
| Card elevation | `shadow-[var(--shift-shadow)] hover:shadow-[var(--shift-shadow-hover)]` |
| Border reveal  | `border border-transparent hover:border-gray-200`                       |
| Action reveal  | `opacity-0 group-hover:opacity-100 transition-opacity`                  |

### Transitions

| Property   | Duration | Easing      |
| ---------- | -------- | ----------- |
| Shadow     | 150ms    | ease-out    |
| Background | 500ms    | ease-in-out |
| Opacity    | 150ms    | ease-out    |

### Status Pulse

Active statuses (OPEN_FOR_PREFERENCES, ASSIGNING) use `animate-pulse` on the StatusBadge dot.

---

## 8. Color Scale Reference

### Desirability Scoring

| Score | Meaning     | Background     | Text              |
| ----- | ----------- | -------------- | ----------------- |
| 1-2   | Easy to get | `bg-blue-50`   | `text-blue-700`   |
| 3     | Moderate    | `bg-gray-100`  | `text-gray-600`   |
| 4-5   | Hard to get | `bg-orange-50` | `text-orange-700` |

### Avatar Gradients

Generated from alias using consistent mapping:

- Blue: `from-blue-400 to-blue-600`
- Purple: `from-purple-400 to-purple-600`
- Green: `from-green-400 to-green-600`
- Orange: `from-orange-400 to-orange-600`
- Pink: `from-pink-400 to-pink-600`
- Cyan: `from-cyan-400 to-cyan-600`

---

## 9. Quick Reference

### Adding a New Lane Type

All color is derived from the template, not from CSS. Follow this flow:

1. **Create the template** via Setup → TemplateManager (sets name, type, capacity, duration in DB).
2. **Optionally pin a color** — set `template.color` (hex string) in the DB if this template needs a fixed visual identity.
3. **Color resolves automatically** — `deriveLanesFromTemplates()` computes `LaneConfig.color` as `template.color || getPaletteColor(index)`.
4. **Color flows as a prop** to: `LaneZoneNode` (background tint), `ShiftBlockNode` (left border), `TemplatePalette` items.
5. **No CSS changes required.** Do not add new `--lane-*` tokens unless you need a CSS variable accessible outside of component props.

### Adding a New Status

1. Add CSS selector to `globals.css @layer base`:

   ```css
   [data-event-status="NEW_STATUS"] {
     --status-bg: #tint;
     --status-accent: #accent;
   }
   ```

2. Add config to `StatusBadge.tsx` STATUS_CONFIG

### Styling a New Panel

Use `GlassPanel` wrapper with standard sections:

```tsx
<GlassPanel className="w-80 border-l border-gray-200">
  <div className="p-4 border-b border-gray-200">{/* Header */}</div>
  <div className="flex-1 overflow-auto p-4 space-y-4">
    {/* Content with SectionLabel components */}
  </div>
  <div className="p-4 border-t border-gray-200">{/* Footer actions */}</div>
</GlassPanel>
```

---

## Resources

- **Token Source:** `app/globals.css`
- **Architecture:** `docs/ARCHITECTURE.md`
- **Frontend Patterns:** `docs/FRONTEND.md`

---

**Last Updated:** 2026-02-28
