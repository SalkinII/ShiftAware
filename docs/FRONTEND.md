# ShiftAware Frontend Patterns

> Reference for coordinate system rules, component registry, reusability rules, and prop conventions.
> Read this before adding a new component or modifying canvas rendering.
>
> Last updated: 2026-03-05

---

## 1. Coordinate System Architecture

> **Critical:** All React Flow positioning must use a single, consistent coordinate transformation model.

### Three Coordinate Spaces

| Space              | Description                                    | Positioning          | Transform                              |
| ------------------ | ---------------------------------------------- | -------------------- | -------------------------------------- |
| **Flow Space**     | Logical coordinates within React Flow canvas   | Node `position` prop | Automatic (React Flow handles)         |
| **Viewport Space** | Visible canvas area with pan/zoom applied      | —                    | Zoom + pan (React Flow)                |
| **Screen Space**   | Physical pixel positions in the browser window | Panel overlays       | Manual via `useScreenCoordinates` hook |

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

| Constant       | Value | Used for                                            |
| -------------- | ----- | --------------------------------------------------- |
| `ZOOM_MINIMAL` | 0.3   | `TimeRulerPanel`: short date labels below this zoom |
| `ZOOM_COMPACT` | 0.7   | `TimeRulerPanel`: hide 15-min ticks below this zoom |

These constants apply to **ruler density only**. Shift card content density uses `ResizeObserver` width thresholds — see DESIGN.md §3.

### Affected Files

| File                                                             | Role                                     |
| ---------------------------------------------------------------- | ---------------------------------------- |
| `components/features/LaneCalendar/utils/coordinates.ts`          | Coordinate math utilities                |
| `components/features/LaneCalendar/hooks/useScreenCoordinates.ts` | Viewport hook                            |
| `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`      | Node (React Flow positions)              |
| `components/features/LaneCalendar/nodes/LaneZoneNode.tsx`        | Node (React Flow positions)              |
| `components/features/LaneCalendar/panels/TimeRulerPanel.tsx`     | Panel (uses `flowToScreenX`)             |
| `components/features/LaneCalendar/panels/LaneLabelPanel.tsx`     | Panel (uses `flowToScreenY`)             |
| `components/features/LaneCalendar/LaneCalendarCanvas.tsx`        | `AlignmentGuides` (uses `flowToScreenX`) |

---

## 2. Component Registry

### Atoms (`components/ui/`)

Before building a new visual element, check this table. If something fits, use it. If you extend an existing atom, update this table.

| Component           | Purpose                          | Use when                                            |
| ------------------- | -------------------------------- | --------------------------------------------------- |
| `ColorStripe`       | Vertical lane color bar          | Any element showing lane or template color identity |
| `AvatarStack`       | Overlapping gradient avatars     | Displaying multiple assigned members                |
| `DesirabilityBadge` | Score pill with star icon        | Showing shift desirability score                    |
| `StatusBadge`       | Event lifecycle status indicator | Header or status display; pulses on active statuses |
| `GlassPanel`        | Frosted glass container          | Sidebars, overlays, property panels                 |
| `SectionLabel`      | Uppercase section header         | Grouping content within a panel                     |
| `ProgressBar`       | Horizontal fill bar              | Staffing coverage, preference satisfaction          |

For new panels, use the `GlassPanel` structure from DESIGN.md §8.

### Feature Components (`components/features/`)

| Component                                   | Purpose                           | Admin        | User         |
| ------------------------------------------- | --------------------------------- | ------------ | ------------ |
| `LaneCalendar/LaneCalendarCanvas`           | React Flow schedule canvas        | ✓ (editable) | ✓ (readOnly) |
| `TemplatePalette`                           | Drag source for creating shifts   | ✓            | —            |
| `LaneCalendar/sidebar/ShiftPropertiesPanel` | Edit shift, manage assignments    | ✓            | —            |
| `AlgorithmResultsModal`                     | Display algorithm preview results | ✓            | —            |
| `SwapInterface`                             | Swap request workflow             | —            | ✓            |
| `ConflictWizard`                            | Conflict detection and resolution | ✓            | —            |
| `Identity/ProfileDetailCard`                | Read-only member profile card     | ✓            | ✓            |
| `ShiftPropertiesPanel/ShiftPreferencePanel` | Three-state preference toggle (Want/Neutral/Don't want); Neutral deletes the preference | — | ✓ |

Distribution heatmap + analysis (`DistributionControlCenter`, `DistributionHeatmap`, `AnalysisTable`) lives under `app/admin/events/[id]/distribution/components/` — mounted event-scoped in the Team Management "Availability Heatmap" tab, and standalone at `/admin/events/[id]/distribution`. Superseded the old `components/features/AvailabilityHeatmap` (role-only eligibility, no click-to-assign) — that component and `GET /api/members/availability` were deleted.

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

| Prop          | Type          | Rule                                                                                                            |
| ------------- | ------------- | --------------------------------------------------------------------------------------------------------------- |
| `color`       | `string`      | Always a resolved hex string. Never a CSS class, Tailwind token, or enum value.                                 |
| `readOnly`    | `boolean?`    | Standard gate for disabling interactions in shared components (e.g. `LaneCalendarCanvas`, `ShiftBlockNode`).    |
| `onClose`     | `() => void`  | Panels always receive this. Never manage close state internally inside a panel.                                 |
| `eventStatus` | `EventStatus` | Passed down from page level. Components never fetch event status themselves.                                    |
| `eventId`     | `string`      | Always explicit. Only use `useEventContext` (from `@/lib/contexts/EventContext`) when a component is deeply nested and prop-drilling is impractical. |

---

## Resources

- **Visual tokens and aesthetics:** `docs/DESIGN.md`
- **Backend three-layer architecture:** `docs/ARCHITECTURE.md`
- **API endpoint reference:** `docs/API.md`
- **Algorithm engine:** `docs/ALGORITHM.md`
