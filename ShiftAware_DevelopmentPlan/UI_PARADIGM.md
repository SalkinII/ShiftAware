# UI Paradigm - Design System v2

**Status:** ✅ Complete  
**Date:** 2026-01-16

---

## Core Principles

- **Compact, not spacey** - Efficient use of space
- **Consistent spacing** - p-4 containers, p-3 cards, gap-2 to gap-4
- **Subtle borders** - Use divide-y, bg-muted, ring-1 instead of explicit borders
- **Smooth transitions** - 200ms duration, ease-in-out
- **Accessibility first** - Focus rings, keyboard navigation, ARIA labels

---

## Design Tokens

**Location:** `tailwind.config.ts`

- **Typography:** Scale (xs to 5xl), weights (light to black), line heights
- **Shadows:** Elevation system (0-5) + focus rings
- **Colors:** Primary, secondary, error, warning, info, success scales
- **Borders:** Width (0-4px), radius (sm to full)
- **Spacing:** 4px base (Tailwind defaults)

---

## Components

### Button
- Variants: primary, secondary, ghost, destructive
- Sizes: sm, md (default), lg
- States: default, hover, active, disabled, loading
- Focus: `focus-visible:ring-2` with offset
- Transitions: 200ms duration

### Input
- States: default, focus, error, disabled
- Help text support
- Error messages with ARIA
- Focus rings with Design System tokens

### Card
- Elevation levels: 0-5
- Hover effects (optional)
- Interactive state (optional)
- Compact padding (p-3)

### Navigation
- Active states with visual indicators
- Focus rings for keyboard navigation
- Smooth transitions (200ms)
- Hover/active feedback

---

## Usage Patterns

### Spacing
```tsx
// Containers
<div className="p-4">...</div>

// Cards
<Card className="p-3">...</Card>

// Gaps
<div className="gap-2">...</div>  // Small
<div className="gap-4">...</div>  // Medium
<div className="gap-6">...</div>  // Large (max)
```

### Borders
```tsx
// Lists
<div className="divide-y divide-gray-200">...</div>

// Contrast
<div className="bg-gray-50 rounded-lg">...</div>

// Outline
<button className="ring-1 ring-gray-300">...</button>
```

### Tiles
```tsx
<div className="px-2 py-1.5 text-sm rounded bg-primary/10">
  <span className="font-medium">{name}</span>
  <span className="text-gray-500 ml-2">{time}</span>
</div>
```

---

## References

- Design System v2: `.context/260115_DESIGN_System2.md`
- Reactive Patterns: `.context/260115_UI_DESIGN_reactive.md`
- Implementation: `DESIGN_SYSTEM_V2_PLAN.md`
