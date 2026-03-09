# ShiftAware: Feudal Solarpunk Theme Design

> **Dark-mode redesign replacing the "Command Center" aesthetic with the Feudal Solarpunk visual language.**
>
> Date: 2026-03-07
> Scope: Approach 3 — full surface audit across all ~35 component files
> Strategy: Token remap (keep semantic class names, replace hex values) + add Solarpunk concept tokens

---

## 1. Design Philosophy

**Retiring:** "Air Traffic Control meets Festival Poster Art / Command Center aesthetic."

**New framing — Feudal Solarpunk:**

> *Village Council meets Living Forest. Collective organization in a world of organic abundance.*

| Principle | New expression |
|---|---|
| Visual metaphor | Bioluminescent council chamber |
| Admin view feel | Dense organic data — moss and ember |
| User view feel | Market board in a sunlit clearing |
| Color character | Deep soil, glowing accents, warm amber |
| Status expression | Directional border glows (not background washes) |
| Motion | Purposeful 500ms transitions (unchanged) |

**Principles carried forward unchanged:**
- Semantic color coding for lane types
- Progressive disclosure (admin dense, user minimal)
- Status-driven chromatics (reinterpreted as glows)
- Motion as feedback

The "glass" metaphor is retired. Panels become dark moss surfaces with slight luminance separation from the base soil. Frosted-glass panels become dark moss overlays.

---

## 2. Token System

### Strategy

Keep every Tailwind semantic class name used in components unchanged (`primary`, `accent`, `success`, `gray`, etc.). Remap their hex values to the Solarpunk palette in `tailwind.config.ts`. Add the Solarpunk concept names (`soil`, `moss`, `bloom`, etc.) as first-class tokens alongside the semantics — available for all new code going forward.

### Semantic Remap

| Semantic scale | Current role | Remaps to | Anchor hex |
|---|---|---|---|
| `primary` | Brand blue, CTAs, active states | `bloom` — violet, interaction | `#8B5CF6` |
| `accent` / `secondary` | Amber highlights | `solar` — amber, primary warmth | `#F59E0B` |
| `success` | Green success states | `canopy` — emerald | `#10B981` |
| `error` | Red destructive | `spore` — rose-red, alert | `#F43F5E` |
| `warning` | Amber warnings | `solar` (same as accent) | `#F59E0B` |
| `info` | Blue informational | `vapor` — cyan, data | `#06B6D4` |
| `gray` | Neutral surfaces / text | Inverted dark scale (see below) | — |

### Gray Scale Inversion

`bg-gray-50` (light tint) → darkest surface. `text-gray-900` (dark text) → near-white text. Semantics are preserved by inverting the scale.

| Token | Current (light) | Remapped (dark) | Role |
|---|---|---|---|
| `gray-50` | `#fafaf9` | `#161C18` | Subtle surface tint |
| `gray-100` | `#f5f5f4` | `#1B241E` moss | Raised surface / card bg |
| `gray-200` | `#e7e5e4` | `#27272A` stone-dark | Dividers |
| `gray-300` | `#d6d3d1` | `#3F3F46` stone | Borders |
| `gray-400` | `#a8a29e` | `#71717A` stone-light | Placeholder / muted text |
| `gray-500` | `#78716c` | `#A1A1AA` | Secondary text |
| `gray-600` | `#57534e` | `#CBD5E1` | Body text |
| `gray-700` | `#44403c` | `#E2E8F0` | Strong text |
| `gray-800` | `#292524` | `#F1F5F9` | Heading text |
| `gray-900` | `#1c1917` | `#F8FAFC` ether | Maximum contrast text |

### Primary Scale Remap (bloom / violet)

| Token | Hex |
|---|---|
| `primary-50` | `#2D1B69` |
| `primary-100` | `#3D2080` |
| `primary-200` | `#5B21B6` |
| `primary-300` | `#6D28D9` |
| `primary-400` | `#7C3AED` |
| `primary-500` | `#8B5CF6` |
| `primary-600` | `#7C3AED` |
| `primary-700` | `#6D28D9` |
| `primary-800` | `#5B21B6` |
| `primary-900` | `#4C1D95` |

### Accent Scale Remap (solar / amber — unchanged hex, already correct)

`accent` / `secondary` hex values stay the same as current (`#F59E0B` family). No changes needed — amber already maps to `solar`.

### Success Scale Remap (canopy / emerald)

| Token | Hex |
|---|---|
| `success-50` | `#064E3B` |
| `success-100` | `#065F46` |
| `success-200` | `#047857` |
| `success-300` | `#059669` |
| `success-400` | `#10B981` |
| `success-500` | `#10B981` |
| `success-600` | `#34D399` |
| `success-700` | `#6EE7B7` |
| `success-800` | `#A7F3D0` |
| `success-900` | `#D1FAE5` |

### Error Scale Remap (spore / rose-red)

| Token | Hex |
|---|---|
| `error-50` | `#4C0519` |
| `error-100` | `#881337` |
| `error-200` | `#9F1239` |
| `error-300` | `#BE123C` |
| `error-400` | `#E11D48` |
| `error-500` | `#F43F5E` |
| `error-600` | `#FB7185` |
| `error-700` | `#FDA4AF` |
| `error-800` | `#FECDD3` |
| `error-900` | `#FFF1F2` |

### New Solarpunk Concept Tokens (added to tailwind.config.ts)

Full vocabulary from `.context/example-tailwind.js`, each with `DEFAULT`, `light`, `dark` variants:

| Name | DEFAULT | light | dark | Semantic role |
|---|---|---|---|---|
| `soil` | `#0D110E` | `#161C18` | `#080A09` | Foundation / page bg |
| `moss` | `#1B241E` | `#253128` | `#121914` | Surface / panel bg |
| `canopy` | `#10B981` | `#34D399` | `#065F46` | Success |
| `solar` | `#F59E0B` | `#FBBF24` | `#92400E` | Primary warmth |
| `bloom` | `#8B5CF6` | `#A78BFA` | `#5B21B6` | Interaction / action |
| `petal` | `#EC4899` | `#F472B6` | `#9D174D` | Social / human |
| `spore` | `#F43F5E` | `#FB7185` | `#9F1239` | Alert / threat |
| `vapor` | `#06B6D4` | `#22D3EE` | `#155E75` | Technical data |
| `stone` | `#3F3F46` | `#71717A` | `#27272A` | Borders / grid |
| `ether` | `#F8FAFC` | `#FFFFFF` | `#CBD5E1` | Typography / contrast |

Box shadows (added):
- `glow-canopy`: `0 0 15px rgba(16, 185, 129, 0.25)`
- `glow-solar`: `0 0 15px rgba(245, 158, 11, 0.25)`
- `glow-bloom`: `0 0 15px rgba(139, 92, 246, 0.25)`

Font family:
- `sans`: `['Plus Jakarta Sans', 'sans-serif']`

---

## 3. Base Layer Changes (globals.css)

| Token / property | Current | New |
|---|---|---|
| `body` background | `#fafaf9` | `#0D110E` (soil) |
| `body` text | `#1c1917` | `#F8FAFC` (ether) |
| border-color reset | `#e7e5e4` | `#3F3F46` (stone) |
| `--glass-bg` | `rgba(255,255,255,0.9)` | `rgba(27,36,30,0.9)` |
| `--glass-blur` | `10px` | `10px` (unchanged) |
| `--font-sans` | `ui-sans-serif, system-ui, ...` | `'Plus Jakarta Sans', sans-serif` |
| `--lane-stripe` | `rgba(0,0,0,0.02)` dark stripe | `rgba(255,255,255,0.03)` light stripe |

### Status Ambient Tokens (retire --status-bg, add --status-glow)

The `--status-bg` and `--status-accent` tokens are retired. The `data-event-status` attribute now drives a `box-shadow` glow on the canvas container.

New token: `--status-glow` (applied as `box-shadow` on the canvas wrapper).

| Status | `--status-glow` value |
|---|---|
| `PLANNING` | `0 0 0 1px #3F3F46` (stone border, no glow) |
| `OPEN_FOR_PREFERENCES` | `0 0 0 1px #06B6D4, 0 0 24px rgba(6,182,212,0.25)` |
| `ASSIGNING` | `0 0 0 1px #F59E0B, 0 0 24px rgba(245,158,11,0.25)` |
| `FINALIZED` | `0 0 0 1px #10B981, 0 0 24px rgba(16,185,129,0.25)` |
| `COMPLETED` | `0 0 0 1px #3F3F46` (stone border, dimmed, no glow) |

Usage: `box-shadow: var(--status-glow)` on the canvas container element (replaces `background-color: var(--status-bg)`).

---

## 4. Surface Hierarchy

| Level | Token | Hex | Used for |
|---|---|---|---|
| Base | `soil` | `#0D110E` | Body, page bg, React Flow canvas bg |
| Raised | `moss` | `#1B241E` | Sidebar, header, cards, GlassPanel |
| Elevated | `moss-light` | `#253128` | Hovered cards, active nav items, input fields |
| Overlay | `stone-dark` | `#27272A` | Modals, popovers, dropdowns |

Borders everywhere: `stone` `#3F3F46`.

**GlassPanel:** `rgba(27,36,30,0.9)` with `border-stone` — dark moss glass.

**ShiftBlockNode:** `bg-white/80 backdrop-blur-sm` → `bg-moss/80 backdrop-blur-sm`. Colored left border unchanged.

**React Flow canvas:** background → `soil`. Grid lines (if shown) → `stone`.

---

## 5. Typography

**Font:** Plus Jakarta Sans, loaded via `next/font/google` in `app/layout.tsx`:

```tsx
import { Plus_Jakarta_Sans } from "next/font/google";
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});
```

Pass `jakarta.variable` to the `<html>` className.

The existing typography hierarchy (DESIGN.md §6) is unchanged — only the rendered font changes. The gray remap handles all text color semantics automatically.

---

## 6. Lane Colors

The 12-color KIMI lane palette **hex values are unchanged** — they are vivid, saturated hues that read strongly on dark backgrounds.

Two adjustments for dark surface rendering:

**Lane zone tint opacity** — increase from 10% to 15% for visibility on soil:
```
backgroundColor: `${color}26`  // was: ${color}1A
```

**Lane stripe** — invert from dark-on-light to light-on-dark (handled in globals.css, see §3).

---

## 7. Component-Level Color Changes

### Desirability Score Colors (DesirabilityBadge)

| Score | Old bg | Old text | New bg | New text |
|---|---|---|---|---|
| 1-2 (easy) | `bg-blue-50` | `text-blue-700` | `bg-vapor/10` | `text-vapor` |
| 3 (moderate) | `bg-gray-100` | `text-gray-600` | `bg-stone` | `text-gray-400` |
| 4-5 (hard) | `bg-orange-50` | `text-orange-700` | `bg-solar/10` | `text-solar` |

### Avatar Gradients

Unchanged — existing gradient colors read well on dark surfaces.

### Login Page

Replace `from-primary-50 via-white to-accent-50` gradient with `from-soil via-moss to-soil`. The form card `bg-white rounded-[2rem]` becomes `bg-moss rounded-[2rem]`. The logo icon gradient (`from-primary-500 to-primary-600`) becomes `from-bloom to-bloom-dark`. Input fields: `bg-gray-50` → `bg-moss-light` (or `bg-stone-dark`), focus: `focus:bg-soil focus:ring-bloom/20 focus:border-bloom`.

---

## 8. Full File Impact Map

### Tier 1 — CSS / Config (2 files)
- `tailwind.config.ts` — remap all semantic scales; add Solarpunk concept tokens, glow shadows, Plus Jakarta Sans font
- `app/globals.css` — update body base, border reset, glass tokens, lane stripe, status glow tokens, font variable

### Tier 2 — Shell / Layout (5 files)
- `app/admin/layout.tsx` — `bg-gray-50 text-gray-900` → `bg-soil text-ether`
- `components/layout/Header.tsx` — `bg-white border-gray-200`, all `text-gray-*`
- `components/layout/AdminSidebar.tsx` — `bg-white border-gray-200`, active `bg-primary-50`
- `components/layout/UserSidebar.tsx` — same pattern as AdminSidebar
- `app/login/page.tsx` — gradient, form card surface, input fields, submit button

### Tier 3 — Pages (6 files)
- `app/admin/shifts/schedule/page.tsx`
- `app/admin/setup/page.tsx`
- `app/admin/team/page.tsx`
- `app/admin/team/manage/page.tsx`
- `app/app/calendar/page.tsx`
- `app/app/identity/page.tsx`

### Tier 4 — Feature Components (~10 files)
- `components/features/LaneCalendar/LaneCalendarCanvas.tsx`
- `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`
- `components/features/LaneCalendar/nodes/LaneZoneNode.tsx`
- `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx`
- `components/features/TemplatePalette/TemplatePalette.tsx`
- `components/features/AlgorithmResultsModal.tsx`
- `components/features/AvailabilityHeatmap.tsx`
- `components/features/ConflictWizard.tsx`
- `components/features/SwapInterface.tsx`
- `components/features/Identity/ProfileDetailCard.tsx`

### Tier 5 — UI Atoms (~12 files)
- `components/ui/Button.tsx`
- `components/ui/Card.tsx`
- `components/ui/Input.tsx`
- `components/ui/Select.tsx`
- `components/ui/GlassPanel.tsx`
- `components/ui/StatusBadge.tsx`
- `components/ui/ConfirmDialog.tsx`
- `components/ui/Popover.tsx`
- `components/ui/Toast.tsx`
- `components/ui/Skeleton.tsx`
- `components/ui/DateTimePicker.tsx`
- `components/ui/DesirabilityBadge.tsx`

**Total: ~35 files.**

---

## 9. What Does Not Change

- Lane color hex values (KIMI 12-color palette — unchanged)
- Lane color resolution architecture (`deriveLanesFromTemplates()`, `LaneConfig.color` as prop)
- All Tailwind semantic class names used in components (`primary-*`, `gray-*`, etc.)
- Typography hierarchy class names (only font changes)
- Component prop conventions (FRONTEND.md §4 — fully preserved)
- Coordinate system architecture (FRONTEND.md §1 — untouched)
- Status lifecycle and transitions
- React Flow canvas architecture

---

## Resources

- **Token source:** `example-tailwind.js` → `tailwind.config.ts`
- **Previous design:** `docs/DESIGN.md` (to be updated after implementation)
- **Frontend patterns:** `docs/FRONTEND.md` (unchanged)
- **Architecture:** `docs/ARCHITECTURE.md` (unchanged)
