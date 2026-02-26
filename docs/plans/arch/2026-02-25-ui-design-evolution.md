# UI Design Evolution — KIMI Treatment

> **Design Document** — Approved visual redesign based on KIMI mockup principles.
>
> For implementation plan, see: `2026-02-25-ui-design-evolution-implementation.md`

**Date:** 2026-02-25
**Status:** Approved
**Approach:** Component-by-component redesign with incremental phases

---

## Overview

Transform ShiftAware's UI from "colored blocks" to "command center" aesthetic using design principles from the KIMI mockup (`docs/260223_UImockup_ShiftAware_KIMI.html`).

### What Changes (Visual Only)

| Component | Change |
|-----------|--------|
| `ShiftBlockNode` | White card + left border accent (was: colored background) |
| `TemplatePalette` | Color stripes + hover states |
| `ShiftPropertiesPanel` | Glass effect, progress bars, polished sections |
| `LaneZoneNode` | Stripe pattern + tinted backgrounds |
| `globals.css` | KIMI tokens, status ambient theming |
| `Header` | StatusBadge component |

### What Stays (Architecture Unchanged)

- Three-layer pattern (route → service → repository)
- React Flow v12 node system
- `LaneCalendarCanvas`, `TimeRulerPanel`, coordinate system
- `useLaneNodes`, `useShiftNodes`, `useCanvasActions` hooks
- All API endpoints and data flow
- `useEventContext` / `useMemberContext` hooks

---

## Phase 1: Tokens & Status Theming

### Token Consolidation

Align `globals.css @theme` to definitive hex values. Add KIMI-specific tokens:

```css
@theme {
  /* Lane colors — 3-tier system */
  --lane-mobile-north: #0ea5e9;
  --lane-mobile-north-dark: #0284c7;
  --lane-mobile-north-light: #7dd3fc;

  --lane-mobile-south: #f59e0b;
  --lane-mobile-south-dark: #d97706;
  --lane-mobile-south-light: #fcd34d;

  --lane-stationary: #10b981;
  --lane-stationary-dark: #059669;
  --lane-stationary-light: #6ee7b7;

  --lane-shift-lead: #8b5cf6;
  --lane-shift-lead-dark: #7c3aed;
  --lane-shift-lead-light: #c4b5fd;

  --lane-super: #ef4444;
  --lane-super-dark: #dc2626;
  --lane-super-light: #fca5a5;

  --lane-buffer: #6b7280;
  --lane-buffer-dark: #4b5563;
  --lane-buffer-light: #d1d5db;
}

@layer base {
  :root {
    /* Shift card shadows */
    --shift-shadow: 0 2px 4px -1px rgba(0,0,0,0.1), 0 2px 2px -1px rgba(0,0,0,0.06);
    --shift-shadow-hover: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);

    /* Glass panel effect */
    --glass-bg: rgba(255, 255, 255, 0.9);
    --glass-blur: 10px;

    /* Lane stripe pattern */
    --lane-stripe: repeating-linear-gradient(
      45deg, transparent, transparent 10px,
      rgba(0,0,0,0.02) 10px, rgba(0,0,0,0.02) 20px
    );

    /* Status defaults */
    --status-bg: transparent;
    --status-accent: var(--color-gray-400);
  }

  /* Status ambient theming */
  [data-event-status="PLANNING"] {
    --status-bg: #f8fafc;
    --status-accent: #64748b;
  }
  [data-event-status="OPEN_FOR_PREFERENCES"] {
    --status-bg: #f0f9ff;
    --status-accent: #0ea5e9;
  }
  [data-event-status="ASSIGNING"] {
    --status-bg: #fff7ed;
    --status-accent: #f97316;
  }
  [data-event-status="FINALIZED"] {
    --status-bg: #f0fdf4;
    --status-accent: #22c55e;
  }
  [data-event-status="COMPLETED"] {
    --status-bg: #fafaf9;
    --status-accent: #a8a29e;
  }
}
```

### StatusBadge Component

New atom for Header — pulsing status indicator:

```tsx
// components/ui/StatusBadge.tsx
interface StatusBadgeProps {
  status: EventStatus;
  pulse?: boolean;
}

export function StatusBadge({ status, pulse = true }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border",
      config.classes,
      pulse && config.pulse && "animate-pulse-slow"
    )}>
      <div className={cn("w-2 h-2 rounded-full", config.dotClass)} />
      {config.label}
    </div>
  );
}
```

---

## Phase 2: ShiftBlockNode Redesign

### Semantic Zoom Levels (Preserved)

All levels use white-card style with left border accent:

| Level | Zoom Range | Content |
|-------|------------|---------|
| Minimal | < 0.3 | Left border + name only |
| Compact | 0.3 - 0.7 | + time range, capacity, desirability badge |
| Standard | 0.7 - 1.5 | + avatar stack, footer hint |
| Detailed | > 1.5 | + member names, voting buttons |

### New Atoms

```tsx
// components/ui/ColorStripe.tsx
export function ColorStripe({ color, className }: { color: string; className?: string })

// components/ui/AvatarStack.tsx
export function AvatarStack({ members, max = 3 }: { members: Member[]; max?: number })

// components/ui/DesirabilityBadge.tsx
export function DesirabilityBadge({ score }: { score: number })
```

### Card Styling

```tsx
<div
  className={cn(
    "bg-white rounded-lg border-l-4 overflow-hidden transition-shadow",
    "shadow-[var(--shift-shadow)] hover:shadow-[var(--shift-shadow-hover)]",
    selected && "ring-2 ring-blue-500",
    isAssignedToCurrentUser && "ring-2 ring-green-500"
  )}
  style={{ borderLeftColor: color }}
>
```

### KIMI Styling Reference

| Element | Classes |
|---------|---------|
| Card | `bg-white rounded-lg border-l-4 shadow-[var(--shift-shadow)]` |
| Time | `text-xs font-medium text-gray-500` |
| Title | `text-sm font-semibold text-gray-900` |
| Desirability pill | `bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium` |
| Avatar circles | `w-6 h-6 rounded-full bg-gradient-to-br border-2 border-white` |
| Footer | `border-t border-gray-100` |
| Hover actions | `opacity-0 group-hover:opacity-100 transition-opacity` |

---

## Phase 3: Template Palette Restyle

### Updated TemplateItem

```tsx
<div className={cn(
  "group flex items-center gap-3 p-2 rounded-lg",
  "hover:bg-gray-50 cursor-grab active:cursor-grabbing",
  "transition-colors border border-transparent hover:border-gray-200"
)}>
  {/* Color stripe */}
  <div
    className="w-1 h-8 rounded-full flex-shrink-0"
    style={{ backgroundColor: template.color }}
  />

  <div className="flex-1 min-w-0">
    <div className="text-sm font-medium text-gray-900 truncate">{template.name}</div>
    <div className="text-xs text-gray-500">{shiftCount} shifts</div>
  </div>

  {/* Grip on hover */}
  <GripVertical className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
</div>
```

---

## Phase 4: ShiftPropertiesPanel Polish

### New Atoms

```tsx
// components/ui/GlassPanel.tsx
export function GlassPanel({ children, className })

// components/ui/SectionLabel.tsx
export function SectionLabel({ children })

// components/ui/ProgressBar.tsx
export function ProgressBar({ value, max, color })
```

### Panel Structure

1. **Header** — Title + close button
2. **Shift Info Card** — Colored background, lane stripe, shift name, date/time
3. **Team Preference** — Progress bar + want/don't want counts
4. **Assignments** — List with hover-reveal remove, dashed add button
5. **Footer** — Save (primary dark) + Delete (ghost red)

### Key Patterns

| Pattern | Implementation |
|---------|----------------|
| Glass effect | `bg-[rgba(255,255,255,0.9)] backdrop-blur-[10px]` |
| Section labels | `text-xs font-semibold text-gray-500 uppercase tracking-wider` |
| Assignment rows | `bg-gray-50 rounded-lg` with hover-reveal remove |
| Dashed add button | `border-2 border-dashed border-gray-300` |

---

## Phase 5: Lane Backgrounds

### LaneZoneNode Update

```tsx
<div
  style={{
    width,
    height,
    backgroundColor: `${color}1A`, // 10% opacity tint
    backgroundImage: 'var(--lane-stripe)',
  }}
  className="rounded-lg"
/>
```

### Lane Labels (if separate)

```tsx
<div className="w-32 flex-shrink-0 flex flex-col justify-center items-end pr-4 border-r-2"
     style={{ borderRightColor: laneColor }}>
  <span className="text-sm font-semibold text-gray-900">{laneName}</span>
  <span className="text-xs text-gray-500">{shiftCount} shifts</span>
</div>
```

---

## New Components Summary

| Component | Location | Purpose |
|-----------|----------|---------|
| `StatusBadge` | `components/ui/StatusBadge.tsx` | Header status indicator with pulse |
| `ColorStripe` | `components/ui/ColorStripe.tsx` | Vertical lane color bar |
| `AvatarStack` | `components/ui/AvatarStack.tsx` | Overlapping member avatars |
| `DesirabilityBadge` | `components/ui/DesirabilityBadge.tsx` | Score pill with star |
| `GlassPanel` | `components/ui/GlassPanel.tsx` | Frosted glass container |
| `SectionLabel` | `components/ui/SectionLabel.tsx` | Uppercase section header |
| `ProgressBar` | `components/ui/ProgressBar.tsx` | Horizontal fill bar |

---

## Verification Checklist

After implementation:

- [ ] Shift blocks are white cards with left border accent
- [ ] Semantic zoom shows appropriate content at each level
- [ ] Desirability badges show correct colors (green/gray/orange)
- [ ] Avatar stacks display overlapping gradient circles
- [ ] Template palette shows color stripes and hover states
- [ ] Properties panel has glass effect and progress bars
- [ ] Lane backgrounds show stripe pattern and tint
- [ ] Status badge pulses for active statuses
- [ ] Canvas background tints based on event status
- [ ] All existing functionality preserved (drag, resize, vote, assign)

---

**Approved:** 2026-02-25
**Next:** Implementation plan via `writing-plans` skill
