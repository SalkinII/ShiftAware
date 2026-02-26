# Backlog List Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Fix all remaining issues from `docs/backlog.txt` and `docs/ManualNotes.txt` — a complete consolidated list of canvas bugs, UX improvements, user-view features, admin parity, service logic, and consistency work.

**Architecture:** Prioritize bugs and UX blockers first; then user/admin parity; then service/validation; finally consistency audits. Maintain Service Architecture (Route → Service → Repository), React Flow patterns, and cache invalidation where applicable.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Prisma (PostgreSQL), React Flow (@xyflow/react v12), Vitest, jsPDF, useStore/useViewport for zoom-aware nodes.

**Refs:** `docs/backlog.txt`, `docs/ManualNotes.txt`, `docs/DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/plans/arch/REQUIREMENTS.md`, `docs/ARCHITECTURE-LAYERS.md`, `.claude/skills/react-flow/SKILL.md`.

---

## Phase 1 Bug Investigation Findings (Systematic Debugging)

> **Source:** Root cause investigation per `.cursor/skills/systematic-debugging/SKILL.md` — findings documented before proposing fixes.

### Bug 1: Shift Resize Left Handle — Root Causes

| Finding | Location | Evidence |
|---------|----------|----------|
| **Position ignored** | `useCanvasActions.ts` `handleResizeEnd` | Uses `node.data.startTime` only; never reads `node.position.x`. When resizing from LEFT, React Flow updates `position.x`; our handler ignores it and sends old startTime. |
| **ResizeParams structure** | React Flow `ResizeParams` | Params include `x`, `y`, `width`, `height`. For left resize, `x` (new position) and `width` both change. |
| **Wrong fallback** | `ShiftBlockNode.tsx:349` | `{ width: p.width ?? (p as any).x ?? width }` — uses `p.x` (position) as width fallback, corrupting duration. |
| **Empty/generic toast** | `useCanvasActions.ts` | `toast.error(data.error \|\| "Failed to update shift")` — Zod returns `error: "Validation error"`; `data.details` (field-specific messages) not shown. Early return when `!node?.data` gives no user feedback. |

**Fix direction:** (1) For left resize: derive `newStartTime` from `xToTime(node.position.x, eventStart)` after React Flow has applied the resize. (2) Pass `params` with both `width` and `x` to handler; handler uses position when available. (3) Unwrap `data.details` for validation errors in toast. (4) Toast on early-return paths.

### Bug 2: Canvas Full Reload on Drag-Drop — Root Causes

| Finding | Location | Evidence |
|---------|----------|----------|
| **Full node replacement** | `LaneCalendarCanvas.tsx:186-189` | `useMemo` runs `setNodes([...laneNodes, ...shiftNodes])` whenever `shiftNodes` changes. Drag success → `refetchShifts()` → shifts refetched → `shiftNodes` recomputed → full `setNodes` replaces all nodes. |
| **Violates React Flow pattern** | Per `.claude/skills/react-flow/SKILL.md` | Correct flow: `[Drag] → onNodesChange → applyNodeChanges → setNodes`. We instead overwrite nodes from external API on every refetch, discarding any in-flight React Flow state. |
| **fitView on refetch** | `LaneCalendarCanvas.tsx:191-204` | `useEffect` runs `fitView` when `shiftNodes.length` changes. Refetch can change length (race) or trigger re-run; fitView resets viewport/zoom. |
| **Cache invalidation timing** | `useCanvasActions.ts`, schedule page | `handleNodeDragStop` / `handleDrop` success → `dispatchEvent(shiftaware:cache-invalidate)` + `onShiftUpdated()` → `refetchShifts()` immediately. |

**Fix direction:** (1) Do not replace nodes from `shiftNodes` on every shiftNodes change during/after drag. Options: (a) Merge API response into current nodes by id, preserving position/width from flow; (b) Debounce refetch so it runs after user interaction settles; (c) Use optimistic update: apply position from drag to local state, then sync API in background without replacing. (2) Remove or narrow fitView trigger — only on initial load or explicit "fit" action, not on every refetch. (3) Ensure React Flow `key` is stable (no key tied to shifts hash).

### Bug 3: Node Content Stacked — Root Causes

| Finding | Location | Evidence |
|---------|----------|----------|
| **Vertical stacking** | `ShiftBlockNode.tsx:296` | `DynamicShiftContent` uses `flex flex-col` and `gap-0.5`; items stack top-to-bottom. |
| **Height-based gating** | `ShiftBlockNode.tsx` RevealItem logic | Each item checks `usedHeight + item.minHeight <= contentHeight`; items compete for vertical space and stack when they fit. |

**Fix direction:** Replace `flex flex-col` with CSS Grid (e.g. `gridTemplateColumns: "1fr 1fr"`) so content distributes horizontally; adjust RevealItem placement to use grid cells.

---

> **Plan amended:** Root cause investigation completed per systematic-debugging. Task 1–3 steps updated with concrete fixes. Refs: `.cursor/skills/systematic-debugging/SKILL.md`, `.claude/skills/react-flow/SKILL.md`.

---

## Complete Backlog Inventory

Items included in this plan (from `backlog.txt` and `ManualNotes.txt`):

| # | Source | Item |
|---|--------|------|
| 1 | ManualNotes | Canvas full reload on drag-drop — poor UX |
| 2 | ManualNotes | Node content stacked below each other — layout regression |
| 3 | ManualNotes | useStore/contextual zoom — swap summary/detail by zoom level |
| 4 | ManualNotes | User list view — want/don't want, assignment state (reuse admin logic) |
| 5 | ManualNotes | Admin team: same detail/create logic as identity claim page |
| 6 | ManualNotes | CreateProfileForm read-only on avatar click (user + admin) |
| 7 | ManualNotes | Attribute/skill validation during assignment |
| 8 | ManualNotes | Shift resize left handle — empty error, wrong position |
| 9 | ManualNotes | Time ruler dates — add year (DD.MM.YYYY) |
| 10 | ManualNotes | Export — choose React Flow image vs PDF |
| 11 | ManualNotes | Colour harmonization — templates match lanes, general UI |
| 12 | ManualNotes | Lane names — initials (multi-word) or first 3 letters (single) |
| 13 | ManualNotes | Zero-occupancy shifts as markers |
| 14 | backlog | Password-based event selection in user view |
| 15 | backlog | Full UI audit — DESIGN.md & ARCHITECTURE.md compliance |

---

## Phase 1: Canvas Bug Fixes (Critical UX)

### Task 1: Shift Resize Left Handle — Empty Error & Wrong Position

**Root cause:** See *Phase 1 Bug Investigation Findings* above. `handleResizeEnd` ignores `node.position.x`; uses `node.data.startTime` only. Left resize updates position in React Flow but we never read it. Toast shows generic "Validation error" without field details.

**Files:**
- Modify: `components/features/LaneCalendar/hooks/useShiftNodes.ts` (pass position in handler)
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx` (pass full params, fix width fallback)
- Modify: `components/features/LaneCalendar/hooks/useCanvasActions.ts` (use position for startTime, unwrap error details)
- Test: Create reproduction test or e2e

**Step 1: Extend OnResizeEndHandler to accept position**

React Flow `ResizeParams` provides `{ x, y, width, height }`. In `useShiftNodes.ts`, extend handler params to `{ width: number; x?: number }`. In `ShiftBlockNode`, pass `{ width: p.width ?? width, x: (p as ResizeParams).x }` — **never** use `p.x` as width fallback (current `(p as any).x ?? width` is incorrect).

**Step 2: Fix handleResizeEnd to use position for startTime**

In `useCanvasActions.ts` `handleResizeEnd`:
- React Flow `ResizeParams` includes `x`, `y`, `width`, `height`. For left resize, `params.x` is the new position. Extend params type to `{ width: number; x?: number }`.
- If `params.x != null`, derive `newStartTime = xToTime(snapX(params.x), eventStart)`. Else use `node.data.startTime` (right-only resize).
- Compute `newEndTime` from `newStartTime + durationMinutes`.
- Send both `startTime` and `endTime` in PUT body.

**Step 3: Unwrap API error for toast**

Replace `toast.error(data.error || "Failed to update shift")` with logic that:
- If `data.details` is a non-empty array, format: `details.map(d => \`\${d.path?.join('.')}: \${d.message}\`).join('; ')`
- Else use `data.message || data.error || "Failed to update shift"`.
- For early returns (`!node`, `!isShiftNodeData`), add `toast.error("Could not update shift")`.

**Step 4: Verify**

Manual: resize left → start moves correctly, no empty toast. Resize right → duration changes correctly. API error → toast shows specific validation message.

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/...
git commit -m "fix: shift left-resize empty error and position"
```

---

### Task 2: Canvas Full Reload on Drag-Drop

**Root cause:** See *Phase 1 Bug Investigation Findings* above. `setNodes([...laneNodes, ...shiftNodes])` runs on every `shiftNodes` change. Drag success → refetch → shiftNodes recomputed → full node replacement. Violates React Flow pattern: `onNodesChange → applyNodeChanges` should drive updates; we overwrite from API instead.

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx`
- Modify: `app/admin/shifts/schedule/page.tsx` (refetch timing)
- Check: `useCache` / cache invalidation listener

**Step 1: Stop full replacement on every shiftNodes change**

Per `.claude/skills/react-flow/SKILL.md`, nodes should be updated via `applyNodeChanges`, not replaced from external source. Options:

- **Option A (merge):** When `shiftNodes` changes, merge by id: for each shift node, if same id exists in current `nodes`, keep that node's `position` and `style` (React Flow may have updated them during drag). Only add new nodes or remove deleted ones. Update `data` from API but preserve flow-owned state.
- **Option B (debounce refetch):** Debounce `refetchShifts` by 300–500ms after `onShiftUpdated`. User sees immediate drag result; API sync happens after interaction settles; avoid refetch during drag.
- **Option C (optimistic):** Don't refetch on drag success. Rely on `onNodesChange` for position; optionally sync to API in background without updating local nodes from response.

**Recommended:** Option A — merge strategy. Implement `mergeShiftNodesIntoFlow(currentNodes, newShiftNodes, lanes, eventStart)` that returns nodes with API data merged in, preserving `position` and `style.width` for existing shift nodes from `currentNodes` when ids match.

**Step 2: Fix fitView trigger**

Change `useEffect` dependency from `[shiftNodes.length, fitView]` to run only on initial mount or when event changes — not on every refetch. E.g. depend on `eventId` or a dedicated "initialLoad" flag; remove fitView from the refetch path.

**Step 3: Ensure stable React Flow key**

Verify `LaneCalendarCanvas` and `ReactFlowProvider` have no `key` tied to `shifts` or derived hash. Key should be stable (e.g. `eventId`) so React doesn't remount the flow on data refresh.

**Step 4: Verify**

Manual: drag shift to new lane/position → no flash, zoom/pan preserved. Switch view mode and back → canvas still stable.

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/... app/admin/shifts/schedule/page.tsx
git commit -m "fix: prevent full canvas reload on shift drag-drop"
```

---

### Task 3: Node Content Layout — Fix Stacked Layout

**Root cause:** See *Phase 1 Bug Investigation Findings* above. `DynamicShiftContent` uses `flex flex-col` and `gap-0.5`; RevealItem logic gates by `usedHeight`, causing vertical stacking.

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`
- Ref: ManualNotes CSS Grid idea; REQUIREMENTS.md 1.3–1.4

**Step 1: Identify the two content modes per DESIGN.md**

DESIGN.md §4 defines two distinct rendering modes in `ShiftBlockNode`:
- `CompactContent` (zoom < `ZOOM_COMPACT` = 0.7): uses `scale(1/zoom)` for zoom-independent text. Stacked vertical layout (time, name, count) is intentional here — do NOT change it.
- `DetailedContent` (zoom >= `ZOOM_COMPACT`): native size, no scaling applied.

The grid fix targets **DetailedContent only**.

**Step 2: Replace flex-col with grid in DetailedContent**

In the `DetailedContent` component (or the equivalent branch), change from `flex flex-col` to CSS Grid. Use `gridTemplateColumns: "1fr 1fr"` (or `"auto 1fr"`) so name, time, capacity, avatars distribute horizontally. Example grid areas: `"name time" / "avatars count"`.

**Step 3: Adapt RevealItem placement inside DetailedContent**

Assign each DetailedContent item to a grid area or column via `gridColumn` / `gridRow`. Ensure attributes/avatars don't stack vertically in this mode.

**Step 4: Leave CompactContent untouched**

The `transform: scale(1/zoom)` and `width: width * zoom` logic in CompactContent must not be altered — it is the documented DESIGN.md §3 visual scaling pattern for zoom-independent text.

**Step 5: Verify at different zoom levels**

Check ZOOM_MINIMAL, ZOOM_COMPACT, ZOOM_FULL — layout remains usable; no overflow or clipping. At zoom < ZOOM_COMPACT, CompactContent still shows correctly with scale(1/zoom).

**Step 6: Commit**

```bash
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx
git commit -m "fix: shift node DetailedContent layout — grid instead of stack"
```

---

## Phase 2: Canvas UX Improvements

### Task 4: Lane Name Abbreviations — Initials or First 3 Letters

**Files:**
- Create: `components/features/LaneCalendar/utils/laneName.ts` (new utility file)
- Create: `components/features/LaneCalendar/utils/laneName.test.ts` (new test file)
- Modify: `components/features/LaneCalendar/panels/LaneLabelsColumn.tsx` (consumes `abbreviateLaneName` — per ARCHITECTURE.md file structure)

**Spec:** Multi-word → initials (e.g. "Mobile North" → "MN"). Single-word → first 3 letters (e.g. "Super" → "Sup").

**Step 1: Write failing test**

In `laneName.test.ts`:

```typescript
it("multi-word returns initials", () => {
  expect(abbreviateLaneName("Mobile North")).toBe("MN");
  expect(abbreviateLaneName("Shift Lead North")).toBe("SLN");
});
it("single-word returns first 3 letters", () => {
  expect(abbreviateLaneName("Super")).toBe("Sup");
  expect(abbreviateLaneName("Bar")).toBe("Bar");
});
```

**Step 2: Run test**

Run: `npx vitest run components/features/LaneCalendar/utils/laneName.test.ts`
Expected: FAIL (current impl returns "Mobile", "Super")

**Step 3: Implement**

```typescript
export function abbreviateLaneName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/);
  if (words.length > 1) {
    return words.map((w) => w[0]?.toUpperCase() ?? "").join("");
  }
  return trimmed.slice(0, 3);
}
```

**Step 4: Run test**

Expected: PASS. Update any tests that expected old behavior.

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/utils/laneName.ts laneName.test.ts
git commit -m "feat: lane name abbreviations — initials or first 3 letters"
```

---

### Task 5: Time Ruler Dates — Add Year (DD.MM.YYYY)

**Files:**
- Modify: `components/features/LaneCalendar/panels/TimeRulerPanel.tsx`

**Current (line 112):** `format(dayMidnight, zoom > 0.3 ? "EEE d MMM" : "d MMM")` — no year.

**Step 1: Change format**

Replace with: `format(dayMidnight, zoom > 0.3 ? "dd.MM.yyyy" : "dd.MM.yyyy")` or keep short format when zoomed out: `zoom > 0.3 ? "dd.MM.yyyy" : "d.M.yy"`.

ManualNotes: "DD.MM.YYYY" — use `dd.MM.yyyy` (date-fns).

**Step 2: Verify**

Check day tier labels show year at appropriate zoom.

**Step 3: Commit**

```bash
git add components/features/LaneCalendar/panels/TimeRulerPanel.tsx
git commit -m "fix: time ruler dates include year (dd.MM.yyyy)"
```

---

### Task 6: Contextual Zoom — useStore for Summary vs Detail

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`
- Ref: ManualNotes useStore example; `ZOOM_MINIMAL`, `ZOOM_COMPACT` in `utils/constants.ts`

**Step 1: Add useViewport or useStore zoom**

```tsx
import { useStore } from "@xyflow/react";

// Inside ShiftBlockNode:
const zoom = useStore((s) => s.transform[2]);
const isDetailed = zoom >= ZOOM_COMPACT; // ZOOM_COMPACT = 0.7 per DESIGN.md §4
```

**Step 2: Conditional layout**

- Low zoom: compact — name/coloured bar only
- High zoom: full grid with attributes, avatars, preference buttons

**Step 3: Register node outside component**

Ensure `nodeTypes` is stable (not recreated each render) to avoid unnecessary re-renders.

**Step 4: Verify**

Zoom in/out → node content swaps between summary and detail.

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx
git commit -m "feat: contextual zoom — summary/detail by zoom level"
```

---

### Task 7: Colour Harmonization — Templates Match Lanes

**Files:**
- Modify: `lib/utils/palette.ts`
- Modify: `components/features/TemplatePalette/TemplatePalette.tsx`
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx` (shift colour)
- Modify: `components/features/LaneCalendar/nodes/LaneZoneNode.tsx` (lane colour)
- Ref: ManualNotes "template colours don't match lane colours"

**Step 1: Audit colour sources**

- Lanes: `getPaletteColor(laneIndex)` from `lib/utils/palette.ts`
- Templates: where is template colour set? TemplatePalette, shift nodes?
- Ensure same palette and same index-by-type mapping for lane and shift.

**Step 2: Unify colour resolution**

Create helper e.g. `getColourForLaneOrTemplate(type: string, index: number)` and use in both lane and shift nodes. Template `type` should map to same index as lane.

**Step 3: Harmonize UI**

Review buttons, badges, panels for consistent colour usage (design system).

**Step 4: Commit**

```bash
git add lib/utils/palette.ts components/features/...
git commit -m "fix: harmonize template and lane colours"
```

---

## Phase 3: Export & Zero-Occupancy

### Task 8: Export — React Flow Image vs PDF Choice

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx` (or wherever export is triggered)
- Create: Export modal or dropdown with "Export as Image (PNG)" and "Export as PDF"
- Note: Export is **client-side only** per ARCHITECTURE.md §6 — no `lib/services/export.ts` exists or is needed.

**Step 1: Find current export UI and existing PNG export**

ARCHITECTURE.md Phase 7 notes "PNG export includes time ruler and lane labels" was completed.
Grep for `Export`, `toPng`, `exportScheduleToPDF`, `html2canvas` in `app/admin/shifts/schedule/` and related components to find what's already wired before adding anything new.

**Step 2: Add export mode selection**

- "Image (PNG)" — extend or reuse the existing React Flow PNG export (already implemented per Phase 7)
- "PDF" — find and reuse existing `exportScheduleToPDF` utility (grep for it in `components/` and `app/`)

**Step 3: Wire both options behind a single UI**

User clicks Export → modal or dropdown: "PNG (lane view)" | "PDF (table)" → call appropriate existing function. Do not duplicate export logic; only add the chooser UI.

**Step 4: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx components/...
git commit -m "feat: export choice — React Flow PNG or PDF"
```

---

### Task 9: Zero-Occupancy Shifts as Markers

**Files:**
- Modify: `lib/services/assignments.service.ts` — skip capacity=0 in `runAllocation` (may already exist per v3.2)
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx` — show "Marker" badge when capacity=0
- Modify: `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx` — display marker info
- Ref: REQUIREMENTS.md 6.1

**Step 1: Verify allocation skip**

Ensure `runAllocation` filters `capacity === 0` shifts before algorithm. If not, add.

**Step 2: Shift node badge**

When `capacity === 0`, render "Marker" badge, no assignment UI.

**Step 3: Service constraint**

No breaking changes to existing capacity>0 logic.

**Step 4: Commit**

```bash
git add lib/services/assignments.service.ts components/features/LaneCalendar/...
git commit -m "feat: zero-occupancy shifts as markers"
```

---

## Phase 4: User View & List

### Task 10: User List View — Want/Don't Want, Assignments

**Files:**
- Create or modify: `app/app/calendar/components/MyShiftsList.tsx` (or similar)
- Reuse: Admin list view logic from `app/admin/shifts/schedule/page.tsx` (shift cards, want/don't want display)
- Ref: ManualNotes "reuse logic from admin list view"

**Step 1: Inspect admin list**

How does admin display want/don't want and assignments? Extract shared components.

**Step 2: Create shared ShiftListCard (optional)**

Or inline reuse: fetch shifts with preferences, assignments; render cards with thumbs up/down state and assigned members.

**Step 3: Add list view to user calendar**

User calendar has `calendarView`: "my-shifts" | "full-schedule". Add list representation that shows:
- Want/don't want selections (when OPEN_FOR_PREFERENCES)
- Assigned shifts (when FINALIZED)

**Step 4: Wire to side panel**

Click shift in list → open side panel with detail (existing behavior).

**Step 5: Commit**

```bash
git add app/app/calendar/... components/...
git commit -m "feat: user list view — want/don't want, assignments"
```

---

### Task 11: Password-Based Event Selection in User View

**Files:**
- Modify: Login/event selection flow
- Modify: `app/app/identity/components/EventSelectionStep.tsx` or equivalent
- Modify: Event model — add `password` or `accessCode` (optional)
- Ref: backlog "define event by password"

**Step 1: Design**

- Option A: Event has optional `accessCode`; user enters code to see that event only.
- Option B: Password on login maps to event(s).

**Step 2: Schema change and migration**

Add to `prisma/schema.prisma`:
```prisma
model Event {
  ...
  accessCode String?  // optional, null means no code required
}
```

Run migration:
```bash
npx prisma migrate dev --name add-event-access-code
```

Expected: new migration file in `prisma/migrations/`, DB column added.

**Step 3: User flow**

- User lands on event selection
- Enter password/code → filter events to those matching
- Show only that event (or set) in calendar

**Step 4: Commit**

```bash
git add prisma/schema.prisma app/app/identity/...
git commit -m "feat: password-based event selection in user view"
```

---

## Phase 5: Admin Team & Profile Parity

### Task 12: Admin Team — Same Detail/Create Logic as Identity Page

**Files:**
- Modify: `app/admin/team/page.tsx` or `app/admin/team/components/MemberListByEvent.tsx`
- Reuse: `CreateProfileForm` from `app/app/identity/components/CreateProfileForm.tsx`
- Add: Create-member flow, inspect/edit member detail

**Step 1: Inspect identity page**

Identity: MemberList, CreateProfileForm, AttributePromptModal.

**Step 2: Add create flow to admin team**

Button "Create member" → open CreateProfileForm (or modal). On submit → POST to members API.

**Step 3: Add detail view**

Click member → show detail panel (name, alias, attributes). Reuse attribute display from identity.

**Step 4: Commit**

```bash
git add app/admin/team/... app/app/identity/components/CreateProfileForm.tsx
git commit -m "feat: admin team — create and detail like identity page"
```

---

### Task 13: Profile Card Read-Only on Avatar Click

**Files:**
- Create: `components/features/Identity/ProfileDetailCard.tsx` (read-only CreateProfileForm)
- Modify: `app/app/identity/page.tsx` — click avatar → show ProfileDetailCard
- Modify: `app/admin/team/` — click avatar → show ProfileDetailCard
- Ref: ManualNotes "reuse create new profile card in read only mode"

**Step 1: Extract read-only profile view**

CreateProfileForm has inputs. Create ProfileDetailCard that renders same fields read-only. Accept `member` prop.

**Step 2: Wire avatar click (user)**

In MemberList, on avatar click → set `selectedMemberId`, show ProfileDetailCard in modal or side panel.

**Step 3: Wire avatar click (admin)**

In admin team list, same behavior.

**Step 4: Commit**

```bash
git add components/features/Identity/ProfileDetailCard.tsx app/app/identity/... app/admin/team/...
git commit -m "feat: profile detail card on avatar click (user + admin)"
```

---

## Phase 6: Service Layer

### Task 14: Attribute Validation During Assignment

**Files:**
- Modify: `lib/services/assignments.service.ts` — `runAllocation`, `createManualAssignment`
- Modify: `lib/algorithm/validator.ts` or optimizer — enforce member attributes match shift requirements
- Ref: ManualNotes "attributes are loaded but not enforced"; `lib/utils/attribute-check.ts`

**Step 1: Inspect current flow**

`runAllocation` loads members, shifts, attributes. Does optimizer consider `getMissingAttributes`?

**Step 2: Add validation**

Before assigning member to shift:
- Load shift required attributes (from template)
- Load member attribute values
- Use `getMissingAttributes` — if missing required, skip that candidate (or fail manual assign with clear error)

**Step 3: Wire in createManualAssignment**

On manual assign, validate attributes; if mismatch, return 400 with message.

**Step 4: Tests**

`tests/unit/services/assignment-attribute-validation.test.ts` — member without required attr cannot be assigned. (Per ARCHITECTURE.md §14 testing structure: service tests live in `tests/unit/services/`.)

**Step 5: Commit**

```bash
git add lib/services/assignments.service.ts lib/algorithm/... lib/utils/attribute-check.ts
git commit -m "feat: enforce attribute requirements during assignment"
```

---

## Phase 7: Audit & Consistency

### Task 15: Full UI Audit — DESIGN.md & ARCHITECTURE.md Compliance

**Purpose:** Audit the complete UI. Produce a gap report. No implementation.

**Refs:** `docs/DESIGN.md`, `docs/ARCHITECTURE.md`

**Deliverable:** A checklist or report documenting compliance gaps. Do not implement fixes in this task.

---

#### Part A: DESIGN.md Compliance

Walk through the entire UI against `docs/DESIGN.md`:

| Area | Check |
|------|-------|
| **1. Design Philosophy** | Admins see dense command-center UI; users see minimal schedule. Shared: bold lane colors, status-driven theming. |
| **2. Token System** | Lane colors use `var(--lane-*)`; status ambient uses `data-event-status` + `var(--status-bg)`, `var(--status-accent)`; effect tokens (`--shift-shadow`, `--glass-bg`, `--lane-stripe`) used consistently |
| **3. Coordinate System** | Node-positioned elements use React Flow only; panel overlays use `useScreenCoordinates` only; no mixing. See DESIGN.md §3 |
| **4. Component Patterns** | ShiftBlockNode (glass card, density thresholds), Template Palette, Properties Panel, Lane backgrounds match described structure |
| **5. Atom Components** | ColorStripe, AvatarStack, DesirabilityBadge, StatusBadge, GlassPanel, SectionLabel, ProgressBar used per spec |
| **6. Typography Hierarchy** | Section labels, card titles, time/subtitle, badge styles match DESIGN.md §6 |
| **7. Interaction Patterns** | Hover states (shadow, border reveal, action reveal); transitions (150ms/500ms); status pulse for active statuses |
| **8. Color Scale** | Desirability scoring colors; avatar gradients per alias |

**Output:** Per-screen list of DESIGN.md violations (e.g., "Schedule list cards use inline color instead of `var(--lane-*)`").

---

#### Part B: ARCHITECTURE.md Compliance

Walk through the codebase against `docs/ARCHITECTURE.md`:

| Area | Check |
|------|-------|
| **1. Three-Layer Pattern** | Routes delegate to services; services use repositories; no direct Prisma in core routes (allowed exceptions: analytical utilities, audit "before" snapshots) |
| **2. Event-Scoped Data** | All event-scoped entities (Shift, Assignment, EventRegistration, etc.) filtered by `eventId` in API and UI |
| **3. Status-Driven UI** | Header shows contextual transition button; status badge reflects current event status; user calendar shows status-appropriate content |
| **4. Component → API Mapping** | Each UI action calls the documented endpoint; correct Service/Repository per ARCHITECTURE.md §6 |
| **5. Context Management** | `useEventContext` and `useMemberContext` used per spec; eventId/memberId passed to APIs; no redundant local selectors |
| **6. Error Handling** | RepositoryError caught in routes; appropriate HTTP status (404, 409, 403) |
| **7. EventStatus Guards** | Services call `assertEventStatusAllows` before mutations; StatusGuardError handled in routes |

**Output:** Per-route / per-component list of architecture violations.

---

#### Scope

- **User UI:** `/app/identity`, `/app/calendar` and all child components
- **Admin UI:** `/admin/setup`, `/admin/shifts/schedule`, `/admin/team`, `/admin/audit`
- **Shared:** Header, sidebars, layout, LaneCalendar components, TemplatePalette, ShiftPropertiesPanel

---

#### Execution Steps

**Step 1:** Create audit document (e.g. `docs/audits/2026-02-26-ui-architecture-audit.md`)

**Step 2:** For each screen/component, run through Part A (DESIGN) and Part B (ARCHITECTURE) checklists. Record deviations.

**Step 3:** Summarize findings: high/medium/low priority gaps.

**Step 4:** Save audit. Do not implement fixes.



## Summary Table

| Task | Phase | Description |
|------|-------|-------------|
| 1 | 1 | Shift resize left — empty error, wrong position |
| 2 | 1 | Canvas full reload on drag-drop |
| 3 | 1 | Node content stacked — grid layout |
| 4 | 2 | Lane names — initials / first 3 letters |
| 5 | 2 | Time ruler — add year (dd.MM.yyyy) |
| 6 | 2 | Contextual zoom (useStore) |
| 7 | 2 | Colour harmonization |
| 8 | 3 | Export — PNG vs PDF choice |
| 9 | 3 | Zero-occupancy markers |
| 10 | 4 | User list view |
| 11 | 4 | Password-based event selection |
| 12 | 5 | Admin team detail/create parity |
| 13 | 5 | Profile card on avatar click |
| 14 | 6 | Attribute validation in assignment |
| 15 | 7 | Full UI audit — DESIGN.md & ARCHITECTURE.md compliance |

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-02-26-backlog-list-plan.md`.

**Two execution options:**

1. **Subagent-Driven (this session)** — Fresh subagent per task, review between tasks, fast iteration.
2. **Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints.

**Which approach?**
