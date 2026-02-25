# ShiftAware Design System

> **Visual language reference for the "Command Center" aesthetic.**
>
> Last updated: 2026-02-25 (KIMI treatment implementation)

---

## 1. Design Philosophy

**Visual Metaphor:** Air Traffic Control meets Festival Poster Art

- **Admins** see dense, data-rich interfaces (command center)
- **Users** see clean, glanceable schedules (festival wristband feel)
- **Shared DNA:** Bold color-coded lanes, high contrast, status-driven ambient theming

### Key Principles

| Principle | Implementation |
|-----------|----------------|
| Semantic Color Coding | Every lane type has persistent color identity |
| Progressive Disclosure | Dense admin data reveals progressively; user views stay minimal |
| Status-Driven Chromatics | Event lifecycle stages have distinct ambient color shifts |
| Motion as Feedback | State changes have purposeful animation (500ms transitions) |

---

## 2. Token System

All tokens defined in `app/globals.css` via Tailwind v4 `@theme` and `@layer base`.

### Lane Colors (3-tier)

| Lane | Default | Dark | Light |
|------|---------|------|-------|
| Mobile North | `#0ea5e9` | `#0284c7` | `#7dd3fc` |
| Mobile South | `#f59e0b` | `#d97706` | `#fcd34d` |
| Stationary | `#10b981` | `#059669` | `#6ee7b7` |
| Shift Lead | `#8b5cf6` | `#7c3aed` | `#c4b5fd` |
| Super | `#ef4444` | `#dc2626` | `#fca5a5` |
| Buffer | `#6b7280` | `#4b5563` | `#d1d5db` |

CSS usage: `var(--lane-mobile-north)`, `var(--lane-mobile-north-dark)`, etc.

### Status Ambient Theming

Applied via `data-event-status` attribute on page wrappers:

| Status | Background | Accent | Pulse |
|--------|------------|--------|-------|
| PLANNING | `#f8fafc` | `#64748b` | No |
| OPEN_FOR_PREFERENCES | `#f0f9ff` | `#0ea5e9` | Yes |
| ASSIGNING | `#fff7ed` | `#f97316` | Yes |
| FINALIZED | `#f0fdf4` | `#22c55e` | No |
| COMPLETED | `#fafaf9` | `#a8a29e` | No |

CSS usage: `var(--status-bg)`, `var(--status-accent)`

### Effect Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--shift-shadow` | `0 2px 4px -1px rgba(0,0,0,0.1), ...` | Shift card rest state |
| `--shift-shadow-hover` | `0 4px 6px -1px rgba(0,0,0,0.1), ...` | Shift card hover |
| `--glass-bg` | `rgba(255, 255, 255, 0.9)` | Panel backgrounds |
| `--glass-blur` | `10px` | Backdrop blur amount |
| `--lane-stripe` | `repeating-linear-gradient(45deg, ...)` | Lane zone pattern |

---

## 3. Component Patterns

### Shift Cards (ShiftBlockNode)

**Structure:** White card with 4px left border in lane color.

```
┌─────────────────────────────────────────┐
│██ Title                    [Score ★]   │
│██ Time range                           │
│██ ●●● Assignments                      │
│██ ─────────────────────────────────    │
│██ Footer hint              [Actions]   │
└─────────────────────────────────────────┘
```

**Semantic Zoom Levels:**

| Level | Zoom | Content |
|-------|------|---------|
| Minimal | < 0.3 | Left border + name only |
| Compact | 0.3 - 0.7 | + time, capacity, desirability |
| Standard | 0.7 - 1.5 | + avatar stack, footer hint |
| Detailed | > 1.5 | + member names, voting buttons |

**Key Classes:**
```css
bg-white rounded-lg border-l-4
shadow-[var(--shift-shadow)] hover:shadow-[var(--shift-shadow-hover)]
```

### Template Palette Items

**Structure:** Horizontal row with color stripe on left.

```
┌─────────────────────────────────────┐
│ ██ Template Name                 ⋮⋮ │
│    X shifts                         │
└─────────────────────────────────────┘
```

**Key Classes:**
```css
group flex items-center gap-3 p-2 rounded-lg
hover:bg-gray-50 border border-transparent hover:border-gray-200
```

Grip icon: `opacity-0 group-hover:opacity-100`

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

---

## 4. Atom Components

| Component | File | Purpose |
|-----------|------|---------|
| `ColorStripe` | `components/ui/ColorStripe.tsx` | Vertical lane color bar |
| `AvatarStack` | `components/ui/AvatarStack.tsx` | Overlapping gradient avatars |
| `DesirabilityBadge` | `components/ui/DesirabilityBadge.tsx` | Score pill with star |
| `StatusBadge` | `components/ui/StatusBadge.tsx` | Header status indicator |
| `GlassPanel` | `components/ui/GlassPanel.tsx` | Frosted glass container |
| `SectionLabel` | `components/ui/SectionLabel.tsx` | Uppercase section header |
| `ProgressBar` | `components/ui/ProgressBar.tsx` | Horizontal fill bar |

---

## 5. Typography Hierarchy

| Element | Classes |
|---------|---------|
| Section label | `text-xs font-semibold text-gray-500 uppercase tracking-wider` |
| Card title | `text-sm font-semibold text-gray-900` |
| Time/subtitle | `text-xs text-gray-500` |
| Footer hint | `text-xs text-gray-400` |
| Badge | `text-xs font-medium` |

---

## 6. Interaction Patterns

### Hover States

| Pattern | Implementation |
|---------|----------------|
| Card elevation | `shadow-[var(--shift-shadow)] hover:shadow-[var(--shift-shadow-hover)]` |
| Border reveal | `border border-transparent hover:border-gray-200` |
| Action reveal | `opacity-0 group-hover:opacity-100 transition-opacity` |

### Transitions

| Property | Duration | Easing |
|----------|----------|--------|
| Shadow | 150ms | ease-out |
| Background | 500ms | ease-in-out |
| Opacity | 150ms | ease-out |

### Status Pulse

Active statuses (OPEN_FOR_PREFERENCES, ASSIGNING) use `animate-pulse` on the StatusBadge dot.

---

## 7. Color Scale Reference

### Desirability Scoring

| Score | Meaning | Background | Text |
|-------|---------|------------|------|
| 1-2 | Easy to get | `bg-blue-50` | `text-blue-700` |
| 3 | Moderate | `bg-gray-100` | `text-gray-600` |
| 4-5 | Hard to get | `bg-orange-50` | `text-orange-700` |

### Avatar Gradients

Generated from alias using consistent mapping:
- Blue: `from-blue-400 to-blue-600`
- Purple: `from-purple-400 to-purple-600`
- Green: `from-green-400 to-green-600`
- Orange: `from-orange-400 to-orange-600`
- Pink: `from-pink-400 to-pink-600`
- Cyan: `from-cyan-400 to-cyan-600`

---

## 8. Quick Reference

### Adding a New Lane Type

1. Add tokens to `globals.css @theme`:
   ```css
   --lane-{name}: #hexcolor;
   --lane-{name}-dark: #darker;
   --lane-{name}-light: #lighter;
   ```

2. Update `ShiftTemplate` in database with new color

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
  <div className="p-4 border-b border-gray-200">
    {/* Header */}
  </div>
  <div className="flex-1 overflow-auto p-4 space-y-4">
    {/* Content with SectionLabel components */}
  </div>
  <div className="p-4 border-t border-gray-200">
    {/* Footer actions */}
  </div>
</GlassPanel>
```

---

## Resources

- **Token Source:** `app/globals.css`
- **Architecture:** `docs/ARCHITECTURE.md`
- **Design Evolution Plan:** `docs/plans/2026-02-25-ui-design-evolution.md`
- **KIMI Mockup:** `docs/plans/arch/260223_UImockup_ShiftAware_KIMI.html`

---

**Last Updated:** 2026-02-25
**Design System Version:** KIMI Treatment v1.0
