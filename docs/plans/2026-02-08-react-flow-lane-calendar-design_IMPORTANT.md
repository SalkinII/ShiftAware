# React Flow Lane Calendar — Design Document

> **Status:** Approved design, pending implementation
> **Date:** 2026-02-08
> **Replaces:** Current custom CSS grid LaneCalendarView

---

## Goal

Replace the current custom CSS grid lane calendar with a React Flow-based canvas that provides pan/zoom, proper drag-and-drop, snap-to-grid, shift repositioning, resize, semantic zoom, and PNG export — features the custom implementation struggled to deliver.

## Architecture Overview

Each shift is a React Flow **node** positioned by `(x, y)` where `x` = time offset in a continuous timeline and `y` = lane row position. Lane background zones are **group nodes** (full-width colored stripes). The time ruler is a fixed overlay that scales with the viewport zoom. No edges — this is a node-only React Flow usage.

```
<SchedulePage>
  ├── <Sidebar>                        (fixed right panel)
  │   ├── <TemplatePalette />          (default view — drag source)
  │   └── <ShiftPropertiesPanel />     (when shift selected)
  │
  └── <LaneCalendarCanvas>             (React Flow instance)
      ├── <ReactFlow>
      │   ├── Lane group nodes         (background zones, not draggable)
      │   ├── Shift nodes              (draggable, resizable, selectable)
      │   ├── Day separator nodes      (vertical lines at midnight boundaries)
      │   └── <TimeRulerPanel />       (scales with viewport, pinned to top)
      │
      ├── <MiniMap />                  (React Flow built-in)
      └── <Controls />                 (zoom in/out/fit — built-in)
```

### React Flow features used for free

- Viewport pan/zoom (scroll to zoom, drag to pan)
- Node selection (click shift → sidebar shows properties)
- Node dragging (reposition shifts)
- `fitView()` (fit all content on screen)
- `toImage()` (PNG export — replaces html2canvas)
- Minimap for orientation on multi-day timelines

---

## Coordinate System

React Flow uses pixel coordinates. We define a mapping:

- **X axis:** `1 hour = 200px` at base zoom (configurable via `PIXELS_PER_HOUR`).
  - A 3-day festival = `3 × 24 × 200 = 14,400px` wide.
- **Y axis:** Each lane is `120px` tall (`LANE_HEIGHT`).
  - 5 lanes = `600px` total height.
- A shift starting at Day 2, 14:00 in lane index 2 → `position: { x: (24+14) × 200, y: 2 × 120 }`.
- Shift node width = `durationHours × 200px`. Height fills the lane (~100px with padding).

### Snap

On drag end, positions are rounded:
- X → nearest 15-minute increment (`PIXELS_PER_HOUR / 4 = 50px`)
- Y → nearest lane row (`Math.round(y / LANE_HEIGHT) × LANE_HEIGHT`)

---

## Node Types

| Node Type | Draggable | Selectable | zIndex | Purpose |
|-----------|-----------|------------|--------|---------|
| `laneZone` | No | No | 0 | Colored background stripe per lane. Full timeline width. |
| `daySeparator` | No | No | 1 | Thin vertical line at each midnight. Labels the day. |
| `shiftBlock` | Yes | Yes | 2 | The actual shift. Constrained to snap to lane Y and time grid. |

---

## Semantic Zoom

Based on `viewport.zoom` from `useViewport()`:

| Zoom | Shift node renders |
|------|--------------------|
| `< 0.3` | Colored bar only — no text |
| `0.3 – 0.7` | Bar + template name label |
| `> 0.7` | Full detail — name, time, capacity, assignment count |

### Time Ruler Tick Density

| Zoom | Ticks shown |
|------|-------------|
| `< 0.3` | Hour labels only |
| `0.3 – 0.7` | 30-minute ticks |
| `> 0.7` | 15-minute ticks |

---

## Drag & Drop

### External drag: Sidebar → Canvas

React Flow doesn't natively support external drag. The established pattern:

1. Sidebar templates use native HTML drag (`draggable="true"`, `onDragStart`).
2. The React Flow wrapper has `onDragOver` (prevent default) and `onDrop`.
3. On drop, convert screen coordinates to flow coordinates via `screenToFlowPosition()`.
4. Derive lane (`Math.round(y / LANE_HEIGHT)`) and time (`x / PIXELS_PER_HOUR`).
5. Snap to 15-minute grid, `POST /api/shifts`, add node.

```
Sidebar                          Canvas
┌──────────┐    HTML drag     ┌─────────────────────┐
│ Template  │ ──────────────► │ onDrop(event)        │
│ "Mobile"  │                 │   screenToFlowPos()  │
│  🟦       │                 │   → lane + time      │
└──────────┘                  │   → POST /api/shifts │
                              │   → addNode()        │
                              └─────────────────────┘
```

### Internal drag: Reposition existing shift

React Flow's built-in node drag with:
- `onNodeDragStop` — snap to grid, derive new lane + time, `PUT /api/shifts/{id}`.

### Resize

`@reactflow/node-resizer` adds resize handles. Constrained to horizontal-only (duration change, not lane height). On resize end → snap width to 15-minute increments → `PUT /api/shifts/{id}`.

---

## Sidebar & Selection

The sidebar has two modes, toggled by shift selection state:

```
┌─────────────────────────────────────────────────────┐
│  No selection              │  Shift selected         │
│  ─────────────             │  ──────────────         │
│  Template Palette          │  Shift Properties       │
│                            │                         │
│  ┌─── Mobile Team ───┐    │  🟦 Mobile Team         │
│  │ 🟦  drag me       │    │  Day 2 · 14:00 – 18:00 │
│  └────────────────────┘    │                         │
│  ┌─── Stationary ────┐    │  Start: [14:00 ▾]       │
│  │ 🟩  drag me       │    │  End:   [18:00 ▾]       │
│  └────────────────────┘    │  Capacity: [4]          │
│  ┌─── Super ─────────┐    │                         │
│  │ 🟧  drag me       │    │  Assigned: 2/4          │
│  └────────────────────┘    │  • Wolf 🐺              │
│                            │  • Bear 🐻              │
│                            │                         │
│                            │  [Delete Shift]         │
└─────────────────────────────────────────────────────┘
```

**Selection flow:**
1. Click shift node → `onNodeClick` → set `selectedShiftId`.
2. Sidebar fetches shift detail, renders properties panel.
3. Edits call `PUT /api/shifts/{id}` and update node position/width.
4. Click canvas background or Escape → `onPaneClick` → clear selection → sidebar returns to palette.

**Data flow principle:** The canvas is the visual projection of API data. The sidebar is the edit interface. All mutations go through the API. The `useCache` pattern already in the app handles refetch.

---

## Time Ruler & Day Boundaries

**Time ruler:** Custom React Flow `Panel` (position `"top-left"`) that reads `useViewport()` and renders tick marks matching the horizontal scale of nodes below.

**Day boundaries:** `daySeparator` nodes — tall vertical lines at each midnight position with day labels (`"Fri 26 Jun"`, `"Sat 27 Jun"`).

**Lane labels:** Fixed column on the left side, outside the React Flow canvas, aligned to lane Y positions. Shows lane color dot and template name. Stays put while canvas scrolls.

```
┌──────────┬────────────────────────────────────────────┐
│          │  Time Ruler (Panel overlay)                 │
├──────────┼────────────────────────────────────────────┤
│ Mobile N │  ░░░░░░░█████░░░░░░░░░████░░░░░░░░░░░░░░  │
│ Mobile S │  ░░░████░░░░░░░░░░██████░░░░░░░░░░░░░░░░  │
│ Station  │  ░░░░░░░░░░████████░░░░░░░░░░████████░░░  │
│ Super    │  ░░░░░░██░░░░░░██░░░░░░██░░░░░░░██░░░░░  │
└──────────┴────────────────────────────────────────────┘
              ↑ day separator lines at midnight
```

---

## File Structure

```
components/features/LaneCalendar/
├── LaneCalendarCanvas.tsx       (ReactFlow instance, viewport, event handlers)
├── nodes/
│   ├── ShiftBlockNode.tsx       (custom node — semantic zoom, resize handle)
│   ├── LaneZoneNode.tsx         (custom node — colored background stripe)
│   └── DaySeparatorNode.tsx     (custom node — vertical line + day label)
├── panels/
│   ├── TimeRulerPanel.tsx       (Panel overlay — scales with viewport)
│   └── LaneLabelsColumn.tsx     (fixed left column outside ReactFlow)
├── sidebar/
│   ├── TemplatePalette.tsx      (drag source — reuse existing logic)
│   └── ShiftPropertiesPanel.tsx (edit form when shift selected)
├── hooks/
│   ├── useShiftNodes.ts         (converts API shifts → ReactFlow nodes)
│   ├── useLaneNodes.ts          (converts lane config → zone + separator nodes)
│   └── useCanvasActions.ts      (drop, drag-stop, resize handlers → API calls)
├── utils/
│   ├── coordinates.ts           (time↔pixel conversion, snap logic)
│   └── constants.ts             (PIXELS_PER_HOUR, LANE_HEIGHT, SNAP_MINUTES)
└── index.ts
```

### What we keep from the existing codebase

- `lib/types/lane.ts` — `deriveLanesFromTemplates()` still produces lane config
- `useCache` pattern — data fetching unchanged
- `useEventContext` — event selection unchanged
- API routes — zero changes needed, same `GET/POST/PUT/DELETE /api/shifts`

### What we replace

- `LaneCalendarView.tsx` and all child components (`LaneDropZone`, `ShiftBlock`, `ResizeHandle`, `DragPreview`, `TimeRuler`)
- The `@dnd-kit/core` dependency for this feature (React Flow + native HTML drag replaces it)
- The `html2canvas` export (React Flow `toImage()` replaces it)

### What stays unchanged

- Schedule page (`page.tsx`) still orchestrates but becomes simpler — canvas logic moves into `LaneCalendarCanvas`

---

## Export

React Flow provides `useReactFlow().toImage()` for native PNG/SVG export — no `html2canvas` needed. This sidesteps CSS color compatibility issues entirely. Call `fitView()` before export to capture the full timeline.

---

## Explicitly Out of Scope

- No edges between shifts (no dependency arrows)
- No multi-select drag (can add later)
- No undo/redo (can add later with React Flow state history)
- No assignment drag (assigning members stays in properties panel)
- No coverage overlay (the scaffolded `CoverageOverlay` was never used)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| React Flow bundle size (~40-50KB gzipped) | Low | Acceptable for admin tool |
| Node count (5-day festival ≈ 155 nodes) | None | React Flow handles thousands |
| Semantic zoom re-renders on zoom change | Low | `React.memo` + shared zoom ref |
| External drag (sidebar → canvas) | Medium | Well-documented pattern using native HTML drag + `screenToFlowPosition()` |

---

## Dependencies

- `@xyflow/react` (React Flow v12+)
- `@reactflow/node-resizer` (horizontal resize handles)

Removes:
- `html2canvas` (replaced by `toImage()`)
- `@dnd-kit/core` usage in lane calendar (React Flow + native drag replaces it; may still be used elsewhere)
