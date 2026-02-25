# Shift Node Restore & Glass Effect — Design

**Date:** 2026-02-25
**Status:** Approved

## Problem

Recent redesign commits (5fa1ec7..be5bb2d) broke shift node readability:
- ShiftBlockNode gutted to a 4px colored bar
- Content moved to separate ShiftAnnotationNode (pointer-events-none, unreadable at low zoom)
- useShiftNodes stripped of all data props
- Text is tiny at every zoom level

## Decision

**Restore the single-node ShiftBlockNode pattern** from commit 2de937d (KIMI era). Delete the annotation node system. Enhance with glass effect and larger typography.

## Architecture

One React Flow node per shift. Content uses `scale(1/zoom)` inside the node for zoom-independent readability.

### scale(1/zoom) Pattern

```
Node wrapper (React Flow applies scale(zoom)):
  └── width: W px, height: H px (flow space)

Content wrapper (we counter-scale):
  └── width: W*zoom px, height: H*zoom px (CSS)
  └── transform: scale(1/zoom), transformOrigin: top left
  → Visual: W × H in node coordinates
  → React Flow: W*zoom × H*zoom on screen ✓

Text inside: fixed pixel sizes (2xl = 24px)
  → After scale(1/zoom): 24px in node space
  → After React Flow scale(zoom): 24px on screen ✓
```

### Visual Style

- Glass: `bg-white/80 backdrop-blur-sm` (lane hue visible through card)
- Left border: `border-l-4` with lane color
- Shadows: `var(--shift-shadow)` / hover variant
- Selection: `ring-2 ring-blue-500`
- Assigned-to-user: `ring-2 ring-green-500`

### Typography

**Minimum text-2xl (24px) for all content.** Specific sizes:

| Element | Size | Weight |
|---------|------|--------|
| Template name | text-3xl (30px) | font-bold |
| Time range | text-2xl (24px) | font-semibold |
| Capacity (e.g. "3/5") | text-2xl (24px) | font-bold |
| Member names | text-2xl (24px) | font-medium |
| Status footer | text-2xl (24px) | font-medium |
| Desirability badge | text-2xl (24px) | font-bold |

### Density Levels (2 tiers)

| Zoom | Density | Content |
|------|---------|---------|
| < 0.7 | Compact | Time, name, capacity fraction, desirability |
| >= 0.7 | Detailed | + avatars, member names, status footer, vote buttons |

### Files

| Action | File |
|--------|------|
| Restore + enhance | `nodes/ShiftBlockNode.tsx` |
| Restore data props | `hooks/useShiftNodes.ts` |
| Delete | `nodes/ShiftAnnotationNode.tsx` |
| Delete | `hooks/useAnnotationNodes.ts` |
| Remove annotation refs | `LaneCalendarCanvas.tsx` |
| Fix alignment guides | `LaneCalendarCanvas.tsx` |
| Fix day label drift | `nodes/DaySeparatorNode.tsx` + `panels/TimeRulerPanel.tsx` |
| Update | `docs/DESIGN.md` |

### Alignment Bug Fixes

1. **AlignmentGuides:** Measure `containerRef.getBoundingClientRect().left` and add to `flowToScreenX()` result
2. **DaySeparatorNode:** Remove label from node, render in TimeRulerPanel (screen space)
