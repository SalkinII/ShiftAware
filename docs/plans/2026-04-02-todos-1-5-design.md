# Design Spec — TODOs 1–5

**Date:** 2026-04-02
**Status:** Approved
**Scope:** Five targeted UI improvements; TODO #6 (feature audit / sidebar restructure) deferred to a separate session.

---

## TODO 1 — Heatmap tab in Team Management

**Goal:** Make `AvailabilityHeatmap` accessible from the sidebar-reachable Team Management page.

**What changes:** `app/admin/team/page.tsx`

- Add a third tab entry to the `tabs` array:
  ```ts
  { id: "heatmap" as TabType, label: "Availability Heatmap", icon: Activity }
  ```
- Extend `TabType` union: `"members" | "allocation" | "heatmap"`
- Render `<AvailabilityHeatmap />` when `activeTab === "heatmap"`
- Import `AvailabilityHeatmap` from `@/components/features/AvailabilityHeatmap/AvailabilityHeatmap`
- Import `Activity` from `lucide-react`
- Tab styling: existing `py-3 px-3 border-b-2 font-medium text-sm min-h-[44px]` — no change to tab style

**No backend or API changes required.**

---

## TODO 2 — "Back to User View" at top of Admin Sidebar

**Goal:** Prevent the absolute-positioned "Admin Mode" banner from overlapping the Back link.

**What changes:** `components/layout/AdminSidebar.tsx`

- Move the "Back to User View" `<Link>` block to the **top** of the `<div className="p-4 pb-36 space-y-8">` content, before the "Administration" section label.
- Add a visual separator below it (`border-b border-gray-100 pb-4 mb-0`) so it reads as a preface to the nav rather than part of it.
- The "Admin Mode" banner stays at `absolute bottom-0` — unchanged.

**Before (structure):**
```
[Administration label]
[nav items]
[Back to User View]   ← can be overlapped
[Admin Mode banner]   ← absolute bottom-0
```

**After (structure):**
```
[Back to User View]   ← always visible, never overlapped
[Administration label]
[nav items]
[Admin Mode banner]   ← absolute bottom-0
```

---

## TODO 3 — Swap Panel: mobile bottom drawer

**Goal:** On mobile (< lg) the w-80 right-side swap panel consumes too much canvas width. Replace with a floating badge + full-width bottom drawer.

**What changes:** `app/admin/shifts/schedule/page.tsx` only — `SwapRequestsPanel` component is unchanged.

### Desktop (lg+) — unchanged
The existing `w-80` side panel behaviour is preserved exactly.

### Mobile (< lg) — new behaviour

**Badge:** When `hasSwapRequests && canShowSwapPanel(...)` a pill floats in the top-right corner of the canvas container:
```
⇄ N swaps pending  ↑
```
- Styling: `bg-amber-50 border border-amber-200 text-amber-800 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm`
- Positioned: `absolute top-3 right-3 z-20` inside the canvas wrapper (which is `relative`)
- Tapping sets `swapDrawerOpen = true`

**Backdrop:** `fixed inset-0 bg-black/40 z-40` — tapping closes the drawer.

**Drawer:**
- `fixed inset-x-0 bottom-0 z-50`
- Uses `GlassPanel` tokens: `bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]`
- `border-t border-white/20 rounded-t-2xl`
- Inner layout:
  - Drag handle: `w-9 h-1 bg-gray-300 rounded-full mx-auto mt-2 mb-1`
  - Header row: section label left, `×` close button right
  - Scrollable body: `max-h-[60vh] overflow-y-auto px-4 pb-6`
  - Renders `<SwapRequestsPanel>` inside (reuses existing component)

**New state:**
```ts
const [swapDrawerOpen, setSwapDrawerOpen] = useState(false);
```
Close on: backdrop tap, `×` button, or after a swap action completes (`onRefresh` callback already exists).

**Responsive wiring:**
- The existing `w-80` panel container gets `hidden lg:flex` so it only appears on desktop.
- The badge gets `lg:hidden` so it only appears on mobile.
- The drawer gets `lg:hidden` so it's never rendered on desktop.

---

## TODO 4 — Harmonise header button elements (mobile)

**Goal:** All interactive elements in page headers follow a consistent visual language across admin and user pages.

### Shared view-toggle standard

All three view-toggle controls use:
```tsx
// Container
<div className="bg-gray-100 rounded-xl p-1 flex">
  // Active button
  <button className="px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg bg-white text-gray-900 shadow-sm transition-all">
  // Inactive button
  <button className="px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg text-gray-500 hover:text-gray-700 transition-all">
```

### Per-file changes

**`app/admin/shifts/schedule/page.tsx`**
- View toggle: replace icon-only `<button p-2>` pair inside `border border-gray-200` with the shared text-pill toggle (labels: "LIST" / "CALENDAR", text-only — matching team/manage and user calendar pattern)
- "← Back to prev status" button: remove `size="sm"` so height matches sibling `Button` components

**`app/admin/team/manage/page.tsx`**
- List/Heatmap toggle: replace custom inline `<button px-3 py-1.5>` pair in `bg-gray-100 rounded-lg p-1` with shared standard (adjust container to `rounded-xl`, button classes to match)

**`app/admin/audit/page.tsx`**
- Refresh button: change `variant="primary"` → `variant="secondary"` (it is a utility action, not the primary CTA)

**`app/(routes)/app/calendar/page.tsx`**
- My Shifts / Full Schedule toggle: change container from `bg-white border border-gray-200 rounded-xl p-1 flex shadow-sm` to `bg-gray-100 rounded-xl p-1 flex`; adjust active state from `bg-primary-500 text-white shadow-md` to `bg-white text-gray-900 shadow-sm` (matches admin pattern)

**`app/admin/setup/page.tsx`** — no change (tabs already have `min-h-[44px]`)
**`app/admin/team/page.tsx`** — no change to existing tabs (new Heatmap tab covered by TODO 1)

---

## TODO 5 — Show actual people wanting/not wanting a shift

**Goal:** Replace "N people want this shift" count lines with real alias pills grouped by vote type.

**What changes:** `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx`

**Data:** Already available — `shift.preferences` includes `{ wantLevel, teamMember: { alias } }` from `findByIdWithDetails` (which does `include: { preferences: { include: { teamMember: true } } }`).

**Replace lines 352–358 with:**

Two sections, each rendered only when the group is non-empty:

1. **"Want this shift"** section — `SectionLabel` header + flex-wrap of green alias pills
   - Pill: `bg-green-50 text-green-800 rounded-full px-2 py-0.5 text-xs font-semibold`
2. **"Don't want"** section — same structure with red pills
   - Pill: `bg-red-50 text-red-800 rounded-full px-2 py-0.5 text-xs font-semibold`

If a group exceeds 6 members, show a `+N more` overflow pill (same style, gray).

Both sections live inside the existing scrollable content area, in the same position as the old count lines. The `<div className="h-1 bg-gray-200 my-2">` divider below them is kept.

---

## Remove completed TODOs from TODO.txt

On completion, remove TODO items 1–5 from `docs/plans/TODO.txt`. Item 6 (feature audit) remains.

---

## Files touched

| File | TODOs |
|---|---|
| `app/admin/team/page.tsx` | 1, 4 |
| `components/layout/AdminSidebar.tsx` | 2 |
| `app/admin/shifts/schedule/page.tsx` | 3, 4 |
| `app/admin/team/manage/page.tsx` | 4 |
| `app/admin/audit/page.tsx` | 4 |
| `app/(routes)/app/calendar/page.tsx` | 4 |
| `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx` | 5 |
| `docs/plans/TODO.txt` | cleanup |

No new component files. No API or database changes.
