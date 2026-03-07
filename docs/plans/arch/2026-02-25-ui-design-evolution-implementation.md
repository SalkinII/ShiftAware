# UI Design Evolution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform ShiftAware's UI to the KIMI "command center" aesthetic — white shift cards with color accents, glass panels, status theming — while preserving all existing architecture and functionality.

**Architecture:** Visual-only changes to existing components. New reusable atoms (`ColorStripe`, `AvatarStack`, `DesirabilityBadge`, `GlassPanel`, `StatusBadge`, `SectionLabel`, `ProgressBar`). CSS tokens consolidated in `globals.css @theme`. Status theming via `data-event-status` HTML attribute + CSS selectors.

**Tech Stack:** Tailwind v4, React Flow v12 (@xyflow/react), Next.js 15 App Router, TypeScript

**Design Document:** `docs/plans/2026-02-25-ui-design-evolution.md`

---

## Phase 1: Tokens & Status Theming

### Task 1.1: Add KIMI Tokens to globals.css

**Files:**
- Modify: `app/globals.css`

**Step 1: Add lane color tokens to @theme block**

Find the `@theme { }` block in `app/globals.css` and add after the existing color definitions:

```css
/* Lane colors — 3-tier system (KIMI) */
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
```

**Step 2: Add KIMI effect tokens to @layer base :root**

Find `@layer base { :root { } }` and add:

```css
/* KIMI shift card shadows */
--shift-shadow: 0 2px 4px -1px rgba(0,0,0,0.1), 0 2px 2px -1px rgba(0,0,0,0.06);
--shift-shadow-hover: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);

/* Glass panel effect */
--glass-bg: rgba(255, 255, 255, 0.9);
--glass-blur: 10px;

/* Lane stripe pattern */
--lane-stripe: repeating-linear-gradient(
  45deg,
  transparent,
  transparent 10px,
  rgba(0,0,0,0.02) 10px,
  rgba(0,0,0,0.02) 20px
);

/* Status ambient defaults */
--status-bg: transparent;
--status-accent: #a8a29e;
```

**Step 3: Verify tokens load**

Run: `npm run dev`

Open browser DevTools, inspect any element, check Computed tab for `--shift-shadow`. Should show the box-shadow value.

**Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat(tokens): add KIMI lane colors, shadows, glass effect tokens"
```

---

### Task 1.2: Add Status Ambient Theming CSS

**Files:**
- Modify: `app/globals.css`

**Step 1: Add status CSS selectors after :root block**

In `@layer base { }`, after the `:root { }` block, add:

```css
/* Event status ambient theming — applied via data-event-status attribute */
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
```

**Step 2: Add pulse-slow animation**

In `@theme { }` block, add:

```css
--animate-pulse-slow: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
```

**Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(tokens): add event status ambient theming CSS selectors"
```

---

### Task 1.3: Create StatusBadge Component

**Files:**
- Create: `components/ui/StatusBadge.tsx`

**Step 1: Create the StatusBadge component**

```tsx
"use client";

import { cn } from "@/lib/utils";
import type { EventStatus } from "@prisma/client";

const STATUS_CONFIG: Record<EventStatus, {
  label: string;
  classes: string;
  dotClass: string;
  pulse: boolean;
}> = {
  PLANNING: {
    label: "Planning",
    classes: "bg-gray-50 text-gray-700 border-gray-200",
    dotClass: "bg-gray-500",
    pulse: false,
  },
  OPEN_FOR_PREFERENCES: {
    label: "Open for Preferences",
    classes: "bg-sky-50 text-sky-700 border-sky-200",
    dotClass: "bg-sky-500",
    pulse: true,
  },
  ASSIGNING: {
    label: "Assigning",
    classes: "bg-orange-50 text-orange-700 border-orange-200",
    dotClass: "bg-orange-500",
    pulse: true,
  },
  FINALIZED: {
    label: "Finalized",
    classes: "bg-green-50 text-green-700 border-green-200",
    dotClass: "bg-green-500",
    pulse: false,
  },
  COMPLETED: {
    label: "Completed",
    classes: "bg-gray-50 text-gray-500 border-gray-200",
    dotClass: "bg-gray-400",
    pulse: false,
  },
};

interface StatusBadgeProps {
  status: EventStatus;
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ status, pulse = true, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border",
        config.classes,
        pulse && config.pulse && "animate-pulse",
        className
      )}
    >
      <div className={cn("w-2 h-2 rounded-full", config.dotClass)} />
      {config.label}
    </div>
  );
}
```

**Step 2: Verify component compiles**

Run: `npx tsc --noEmit`

Expected: No errors related to StatusBadge.tsx

**Step 3: Commit**

```bash
git add components/ui/StatusBadge.tsx
git commit -m "feat(ui): add StatusBadge component with pulse animation"
```

---

### Task 1.4: Apply Status Theming to Schedule Page

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

**Step 1: Find the main content wrapper**

Search for the div that wraps `<LaneCalendarCanvas`. It likely has `className="flex-1"` or similar.

**Step 2: Add data-event-status attribute and status background**

Update the wrapper div:

```tsx
// Near the top of the component, get selectedEvent from context:
const { selectedEvent } = useEventContext(true);

// On the canvas wrapper div (find the one wrapping LaneCalendarCanvas):
<div
  data-event-status={selectedEvent?.status}
  className="flex-1 flex flex-col bg-[var(--status-bg)] transition-colors duration-500"
>
  {/* ... LaneCalendarCanvas and other content ... */}
</div>
```

**Step 3: Visual verification**

Run: `npm run dev`

1. Open `/admin/shifts/schedule`
2. Change event status via the database or API
3. Observe canvas background tint changes (subtle)

**Step 4: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "feat(schedule): apply status ambient theming to canvas wrapper"
```

---

### Task 1.5: Apply Status Theming to User Calendar

**Files:**
- Modify: `app/app/calendar/page.tsx`

**Step 1: Add data-event-status to user calendar wrapper**

Similar to Task 1.4, find the main content wrapper and add:

```tsx
const { selectedEvent } = useEventContext(false);

<div
  data-event-status={selectedEvent?.status}
  className="flex-1 bg-[var(--status-bg)] transition-colors duration-500"
>
  {/* ... calendar content ... */}
</div>
```

**Step 2: Visual verification**

Run: `npm run dev`

Open `/app/calendar` and verify background tint matches event status.

**Step 3: Commit**

```bash
git add app/app/calendar/page.tsx
git commit -m "feat(calendar): apply status ambient theming to user calendar"
```

---

## Phase 2: ShiftBlockNode Redesign

### Task 2.1: Create ColorStripe Atom

**Files:**
- Create: `components/ui/ColorStripe.tsx`

**Step 1: Create the component**

```tsx
import { cn } from "@/lib/utils";

interface ColorStripeProps {
  color: string;
  className?: string;
}

export function ColorStripe({ color, className }: ColorStripeProps) {
  return (
    <div
      className={cn("w-1 rounded-full flex-shrink-0", className)}
      style={{ backgroundColor: color }}
    />
  );
}
```

**Step 2: Commit**

```bash
git add components/ui/ColorStripe.tsx
git commit -m "feat(ui): add ColorStripe atom component"
```

---

### Task 2.2: Create AvatarStack Atom

**Files:**
- Create: `components/ui/AvatarStack.tsx`

**Step 1: Create the component**

```tsx
import { cn } from "@/lib/utils";

interface Member {
  alias: string;
  avatarId?: string;
}

interface AvatarStackProps {
  members: Member[];
  max?: number;
  size?: "sm" | "md";
  className?: string;
}

// Generate consistent gradient colors from alias
function getGradientColors(alias: string): [string, string] {
  const colors = [
    ["from-blue-400", "to-blue-600"],
    ["from-purple-400", "to-purple-600"],
    ["from-green-400", "to-green-600"],
    ["from-orange-400", "to-orange-600"],
    ["from-pink-400", "to-pink-600"],
    ["from-cyan-400", "to-cyan-600"],
  ];
  const index = alias.charCodeAt(0) % colors.length;
  return colors[index] as [string, string];
}

function getInitials(alias: string): string {
  return alias
    .split(/[\s_-]/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AvatarStack({ members, max = 3, size = "sm", className }: AvatarStackProps) {
  const displayed = members.slice(0, max);
  const remaining = members.length - max;

  const sizeClasses = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-8 h-8 text-xs",
  };

  return (
    <div className={cn("flex -space-x-2", className)}>
      {displayed.map((member) => {
        const [from, to] = getGradientColors(member.alias);
        return (
          <div
            key={member.alias}
            className={cn(
              "rounded-full bg-gradient-to-br border-2 border-white flex items-center justify-center text-white font-medium",
              from,
              to,
              sizeClasses[size]
            )}
            title={member.alias}
          >
            {member.avatarId || getInitials(member.alias)}
          </div>
        );
      })}
      {remaining > 0 && (
        <div
          className={cn(
            "rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-gray-600 font-medium",
            sizeClasses[size]
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add components/ui/AvatarStack.tsx
git commit -m "feat(ui): add AvatarStack atom with gradient avatars"
```

---

### Task 2.3: Create DesirabilityBadge Atom

**Files:**
- Create: `components/ui/DesirabilityBadge.tsx`

**Step 1: Create the component**

```tsx
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface DesirabilityBadgeProps {
  score: number;
  className?: string;
}

export function DesirabilityBadge({ score, className }: DesirabilityBadgeProps) {
  // Score 1-2: easy to get (blue/cool)
  // Score 3: moderate (gray)
  // Score 4-5: hard to get (orange/hot)
  const colorClasses =
    score <= 2
      ? "bg-blue-50 text-blue-700"
      : score === 3
        ? "bg-gray-100 text-gray-600"
        : "bg-orange-50 text-orange-700";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        colorClasses,
        className
      )}
      title={`Desirability: ${score}/5 — ${score <= 2 ? "easier to get" : score >= 4 ? "harder to get" : "moderate"}`}
    >
      <span>{score.toFixed(1)}</span>
      <Star className="w-3 h-3 fill-current" />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/ui/DesirabilityBadge.tsx
git commit -m "feat(ui): add DesirabilityBadge atom with color scale"
```

---

### Task 2.4: Redesign ShiftBlockNode — Minimal & Compact Views

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`

**Step 1: Add imports for new atoms**

At the top of the file, add:

```tsx
import { DesirabilityBadge } from "@/components/ui/DesirabilityBadge";
import { AvatarStack } from "@/components/ui/AvatarStack";
```

**Step 2: Create helper for zoom density**

Add after the imports:

```tsx
type ZoomDensity = "minimal" | "compact" | "standard" | "detailed";

function getZoomDensity(zoom: number): ZoomDensity {
  if (zoom < ZOOM_MINIMAL) return "minimal";
  if (zoom < ZOOM_COMPACT) return "compact";
  if (zoom < 1.5) return "standard";
  return "detailed";
}
```

**Step 3: Rewrite the component render**

Replace the entire return statement with the new KIMI card structure:

```tsx
function ShiftBlockNodeComponent({ data, selected }: NodeProps) {
  const {
    shiftId,
    templateName,
    color,
    startTime,
    endTime,
    capacity,
    assignmentCount,
    width,
    desirabilityScore,
    assignedMembers,
    isAssignedToCurrentUser,
    onResizeEnd,
    readOnly,
    onVoteWant,
    onVoteDontWant,
  } = data as ShiftBlockData;

  const { zoom } = useViewport();
  const density = getZoomDensity(zoom);
  const isFull = assignmentCount >= capacity;

  return (
    <>
      {!readOnly && (
        <NodeResizer
          isVisible={selected}
          minWidth={SNAP_PIXELS}
          handleStyle={{ width: 8, height: 24, borderRadius: 2 }}
          lineStyle={{ borderWidth: 0 }}
          keepAspectRatio={false}
          onResizeEnd={(e, p) => {
            try {
              const result = onResizeEnd?.(e, p);
              if (result instanceof Promise) {
                result.catch((err) => console.error("Resize failed:", err));
              }
            } catch (err) {
              console.error("Resize failed:", err);
            }
          }}
        />
      )}

      <div
        style={{
          width: `${width}px`,
          height: `${SHIFT_NODE_HEIGHT}px`,
          borderLeftColor: color,
        }}
        className={cn(
          "bg-white rounded-lg border-l-4 overflow-hidden cursor-grab group",
          "shadow-[var(--shift-shadow)] hover:shadow-[var(--shift-shadow-hover)]",
          "transition-shadow",
          selected && "ring-2 ring-blue-500",
          isAssignedToCurrentUser && "ring-2 ring-green-500"
        )}
      >
        {density === "minimal" && (
          <MinimalContent
            templateName={templateName}
            zoom={zoom}
            width={width}
          />
        )}
        {density === "compact" && (
          <CompactContent
            templateName={templateName}
            startTime={startTime}
            endTime={endTime}
            assignmentCount={assignmentCount}
            capacity={capacity}
            desirabilityScore={desirabilityScore}
            zoom={zoom}
            width={width}
          />
        )}
        {density === "standard" && (
          <StandardContent
            templateName={templateName}
            startTime={startTime}
            endTime={endTime}
            assignmentCount={assignmentCount}
            capacity={capacity}
            desirabilityScore={desirabilityScore}
            assignedMembers={assignedMembers}
            isFull={isFull}
          />
        )}
        {density === "detailed" && (
          <DetailedContent
            shiftId={shiftId}
            templateName={templateName}
            startTime={startTime}
            endTime={endTime}
            assignmentCount={assignmentCount}
            capacity={capacity}
            desirabilityScore={desirabilityScore}
            assignedMembers={assignedMembers}
            isFull={isFull}
            readOnly={readOnly}
            onVoteWant={onVoteWant}
            onVoteDontWant={onVoteDontWant}
          />
        )}
      </div>
    </>
  );
}
```

**Step 4: Add MinimalContent sub-component**

Add before the main component:

```tsx
function MinimalContent({
  templateName,
  zoom,
  width,
}: {
  templateName: string;
  zoom: number;
  width: number;
}) {
  return (
    <div
      className="h-full flex items-center px-2"
      style={{
        transform: `scale(${1 / zoom})`,
        transformOrigin: "left center",
        width: width * zoom,
      }}
    >
      <span className="text-sm font-medium text-gray-900 truncate">
        {templateName}
      </span>
    </div>
  );
}
```

**Step 5: Add CompactContent sub-component**

```tsx
function CompactContent({
  templateName,
  startTime,
  endTime,
  assignmentCount,
  capacity,
  desirabilityScore,
  zoom,
  width,
}: {
  templateName: string;
  startTime: string;
  endTime: string;
  assignmentCount: number;
  capacity: number;
  desirabilityScore?: number;
  zoom: number;
  width: number;
}) {
  return (
    <div
      className="h-full flex flex-col justify-center px-2 py-1"
      style={{
        transform: `scale(${1 / zoom})`,
        transformOrigin: "left center",
        width: width * zoom,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-gray-900 truncate">
          {templateName}
        </span>
        {desirabilityScore != null && (
          <DesirabilityBadge score={desirabilityScore} />
        )}
      </div>
      <div className="text-xs text-gray-500">
        {format(new Date(startTime), "HH:mm")}–{format(new Date(endTime), "HH:mm")}
      </div>
      <div className="text-xs text-gray-500">
        {assignmentCount}/{capacity}
      </div>
    </div>
  );
}
```

**Step 6: Verify visually**

Run: `npm run dev`

Open `/admin/shifts/schedule`, zoom out to minimal/compact levels. Verify:
- Cards are white with left border in lane color
- Shadow appears, increases on hover
- Content scales correctly at different zoom levels

**Step 7: Commit**

```bash
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx
git commit -m "feat(ShiftBlockNode): KIMI white card style — minimal & compact views"
```

---

### Task 2.5: Add Standard & Detailed Views to ShiftBlockNode

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`

**Step 1: Add StandardContent sub-component**

```tsx
function StandardContent({
  templateName,
  startTime,
  endTime,
  assignmentCount,
  capacity,
  desirabilityScore,
  assignedMembers,
  isFull,
}: {
  templateName: string;
  startTime: string;
  endTime: string;
  assignmentCount: number;
  capacity: number;
  desirabilityScore?: number;
  assignedMembers?: Array<{ alias: string; avatarId: string }>;
  isFull: boolean;
}) {
  const needed = capacity - assignmentCount;

  return (
    <div className="h-full flex flex-col p-3">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {templateName}
          </div>
          <div className="text-xs text-gray-500">
            {format(new Date(startTime), "HH:mm")} – {format(new Date(endTime), "HH:mm")}
          </div>
        </div>
        {desirabilityScore != null && (
          <DesirabilityBadge score={desirabilityScore} className="flex-shrink-0" />
        )}
      </div>

      {/* Assignments */}
      <div className="flex items-center gap-2 mb-2">
        {assignedMembers && assignedMembers.length > 0 && (
          <AvatarStack members={assignedMembers} max={3} />
        )}
        <span className="text-xs text-gray-500">
          {assignmentCount}/{capacity} assigned
        </span>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-2 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {isFull ? "Fully staffed" : `Needs ${needed} more`}
        </span>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Edit hint - actual button in detailed view */}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add DetailedContent sub-component**

```tsx
function DetailedContent({
  shiftId,
  templateName,
  startTime,
  endTime,
  assignmentCount,
  capacity,
  desirabilityScore,
  assignedMembers,
  isFull,
  readOnly,
  onVoteWant,
  onVoteDontWant,
}: {
  shiftId: string;
  templateName: string;
  startTime: string;
  endTime: string;
  assignmentCount: number;
  capacity: number;
  desirabilityScore?: number;
  assignedMembers?: Array<{ alias: string; avatarId: string }>;
  isFull: boolean;
  readOnly?: boolean;
  onVoteWant?: (shiftId: string) => void;
  onVoteDontWant?: (shiftId: string) => void;
}) {
  const needed = capacity - assignmentCount;

  return (
    <div className="h-full flex flex-col p-3">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {templateName}
          </div>
          <div className="text-xs text-gray-500">
            {format(new Date(startTime), "HH:mm")} – {format(new Date(endTime), "HH:mm")}
          </div>
        </div>
        {desirabilityScore != null && (
          <DesirabilityBadge score={desirabilityScore} className="flex-shrink-0" />
        )}
      </div>

      {/* Assignments with names */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {assignedMembers && assignedMembers.length > 0 && (
          <>
            <AvatarStack members={assignedMembers} max={4} />
            <span className="text-xs text-gray-500">
              {assignedMembers.slice(0, 3).map((m) => m.alias).join(", ")}
              {assignedMembers.length > 3 && ` +${assignedMembers.length - 3}`}
            </span>
          </>
        )}
        {(!assignedMembers || assignedMembers.length === 0) && (
          <span className="text-xs text-gray-400">No assignments</span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto pt-2 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {isFull ? "Fully staffed" : `Needs ${needed} more`}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {readOnly && onVoteWant && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVoteWant(shiftId);
              }}
              className="p-1 rounded bg-gray-100 hover:bg-green-100 hover:text-green-600 transition-colors"
              title="Want this shift"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
          )}
          {readOnly && onVoteDontWant && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVoteDontWant(shiftId);
              }}
              className="p-1 rounded bg-gray-100 hover:bg-red-100 hover:text-red-600 transition-colors"
              title="Don't want this shift"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Visual verification**

Run: `npm run dev`

Open `/admin/shifts/schedule`, zoom in to standard and detailed levels. Verify:
- Avatar stack shows overlapping gradient circles
- Footer has divider line
- Voting buttons appear in detailed view (user calendar, readOnly mode)
- "Needs X more" or "Fully staffed" shows correctly

**Step 4: Commit**

```bash
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx
git commit -m "feat(ShiftBlockNode): KIMI card style — standard & detailed views with avatars"
```

---

## Phase 3: Template Palette Restyle

### Task 3.1: Update TemplatePalette with Color Stripes

**Files:**
- Modify: `components/features/TemplatePalette/TemplatePalette.tsx`

**Step 1: Import ColorStripe**

Add at top:

```tsx
import { ColorStripe } from "@/components/ui/ColorStripe";
```

**Step 2: Update TemplateItem render**

Replace the TemplateItem component's return with:

```tsx
function TemplateItem({ template, compact = false }: TemplateItemProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      "application/shiftaware-template",
      JSON.stringify(template)
    );
    e.dataTransfer.effectAllowed = "copy";
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  if (compact) {
    return (
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className={cn(
          "group flex items-center gap-2 px-3 py-1.5 rounded-lg",
          "bg-white hover:bg-gray-50 cursor-grab active:cursor-grabbing",
          "border border-transparent hover:border-gray-200 transition-colors",
          isDragging && "opacity-50"
        )}
      >
        <ColorStripe color={template.color || "#6b7280"} className="h-6" />
        <span className="font-medium text-xs text-gray-900 truncate">
          {template.name}
        </span>
        <GripVertical className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        "group flex items-center gap-3 p-2 rounded-lg",
        "hover:bg-gray-50 cursor-grab active:cursor-grabbing",
        "border border-transparent hover:border-gray-200 transition-colors",
        isDragging && "opacity-50"
      )}
    >
      <ColorStripe color={template.color || "#6b7280"} className="h-8" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {template.name}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>
            {template.startTime} ({Math.round(template.durationMinutes / 60)}h)
          </span>
        </div>
      </div>
      <GripVertical className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
```

**Step 3: Visual verification**

Run: `npm run dev`

Open `/admin/shifts/schedule`, check sidebar template palette:
- Each template has a color stripe on the left
- Hover reveals border and grip icon
- Drag and drop still works

**Step 4: Commit**

```bash
git add components/features/TemplatePalette/TemplatePalette.tsx
git commit -m "feat(TemplatePalette): KIMI style with color stripes and hover states"
```

---

## Phase 4: Properties Panel Polish

### Task 4.1: Create GlassPanel Atom

**Files:**
- Create: `components/ui/GlassPanel.tsx`

**Step 1: Create the component**

```tsx
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
}

export function GlassPanel({ children, className }: GlassPanelProps) {
  return (
    <div
      className={cn(
        "bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]",
        className
      )}
    >
      {children}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/ui/GlassPanel.tsx
git commit -m "feat(ui): add GlassPanel atom with backdrop blur"
```

---

### Task 4.2: Create SectionLabel and ProgressBar Atoms

**Files:**
- Create: `components/ui/SectionLabel.tsx`
- Create: `components/ui/ProgressBar.tsx`

**Step 1: Create SectionLabel**

```tsx
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SectionLabelProps {
  children: ReactNode;
  className?: string;
}

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <label
      className={cn(
        "text-xs font-semibold text-gray-500 uppercase tracking-wider block",
        className
      )}
    >
      {children}
    </label>
  );
}
```

**Step 2: Create ProgressBar**

```tsx
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max: number;
  color?: "green" | "blue" | "orange" | "gray";
  className?: string;
}

const colorClasses = {
  green: "bg-green-500",
  blue: "bg-blue-500",
  orange: "bg-orange-500",
  gray: "bg-gray-500",
};

const textColorClasses = {
  green: "text-green-600",
  blue: "text-blue-600",
  orange: "text-orange-600",
  gray: "text-gray-600",
};

export function ProgressBar({
  value,
  max,
  color = "green",
  className,
}: ProgressBarProps) {
  const percent = Math.min(100, Math.round((value / max) * 100));

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", colorClasses[color])}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={cn("text-sm font-bold", textColorClasses[color])}>
        {value.toFixed(1)}/{max}
      </span>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add components/ui/SectionLabel.tsx components/ui/ProgressBar.tsx
git commit -m "feat(ui): add SectionLabel and ProgressBar atoms"
```

---

### Task 4.3: Polish ShiftPropertiesPanel

**Files:**
- Modify: `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx`

**Step 1: Add imports**

```tsx
import { GlassPanel } from "@/components/ui/GlassPanel";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ColorStripe } from "@/components/ui/ColorStripe";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { X, Plus } from "lucide-react";
```

**Step 2: Wrap outer element with GlassPanel**

Change the outer Card to GlassPanel and restructure:

```tsx
export function ShiftPropertiesPanel({
  shiftId,
  eventStatus,
  onClose,
  onUpdated,
}: ShiftPropertiesPanelProps) {
  // ... existing state and logic ...

  if (loading) {
    return (
      <GlassPanel className="w-80 border-l border-gray-200 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </div>
      </GlassPanel>
    );
  }

  const laneColor = shift?.template?.color || "#6b7280";
  const wantCount = shift?.preferences?.filter((p: any) => p.wantLevel === "WANT").length || 0;
  const dontWantCount = shift?.preferences?.filter((p: any) => p.wantLevel === "DONT_WANT").length || 0;

  return (
    <GlassPanel className="w-80 border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Shift Details</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Shift Info Card */}
        <div className="bg-sky-50 rounded-lg p-3 border border-sky-100">
          <div className="flex items-center gap-2 mb-2">
            <ColorStripe color={laneColor} className="h-4" />
            <span className="text-xs font-medium text-sky-900 uppercase tracking-wider">
              {shift?.template?.name || "Shift"}
            </span>
          </div>
          <div className="text-lg font-bold text-gray-900">
            {shift?.template?.name}
          </div>
          <div className="text-sm text-gray-600">
            {shift && format(new Date(shift.startTime), "MMM d")} •{" "}
            {shift && format(new Date(shift.startTime), "HH:mm")}–
            {shift && format(new Date(shift.endTime), "HH:mm")}
          </div>
        </div>

        {/* Team Preference */}
        {shift?.desirabilityScore && (
          <div>
            <SectionLabel className="mb-2">Team Preference</SectionLabel>
            <ProgressBar
              value={shift.desirabilityScore}
              max={5}
              color={shift.desirabilityScore >= 4 ? "orange" : shift.desirabilityScore <= 2 ? "blue" : "gray"}
            />
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>{wantCount} want this</span>
              <span>{dontWantCount} don't want</span>
            </div>
          </div>
        )}

        {/* Assignments */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>Assigned</SectionLabel>
            <span className="text-xs text-gray-400">
              {shift?.assignments?.length || 0}/{shift?.capacity}
            </span>
          </div>

          <div className="space-y-2">
            {shift?.assignments?.map((assignment: any) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg group"
              >
                <div className="flex items-center gap-2">
                  <AvatarStack
                    members={[assignment.teamMember]}
                    max={1}
                    size="md"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {assignment.teamMember?.alias}
                    </div>
                    <div className="text-xs text-gray-500">
                      {assignment.role}
                    </div>
                  </div>
                </div>
                {canManualAssign && (
                  <button
                    onClick={() => handleRemoveAssignment(assignment.id)}
                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add Member Button */}
          {canManualAssign && availableMembers.length > 0 && (
            <div className="mt-2">
              <select
                value={selectedMemberToAdd}
                onChange={(e) => setSelectedMemberToAdd(e.target.value)}
                className="w-full p-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 transition-colors"
              >
                <option value="">+ Add Member</option>
                {availableMembers.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.alias}
                  </option>
                ))}
              </select>
              {selectedMemberToAdd && (
                <Button
                  size="sm"
                  className="w-full mt-2"
                  onClick={handleAddAssignment}
                >
                  Add {availableMembers.find((m: any) => m.id === selectedMemberToAdd)?.alias}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        <Button
          variant="ghost"
          className="w-full text-red-600 hover:bg-red-50"
          onClick={() => {/* TODO: implement delete */}}
        >
          Delete Shift
        </Button>
      </div>
    </GlassPanel>
  );
}
```

**Step 3: Visual verification**

Run: `npm run dev`

Open `/admin/shifts/schedule`, click a shift to open the panel:
- Glass blur effect visible
- Shift info card has sky-blue background
- Progress bar for desirability
- Assignment rows with hover-reveal remove button
- Proper section labels (uppercase, tracking-wider)

**Step 4: Commit**

```bash
git add components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx
git commit -m "feat(ShiftPropertiesPanel): KIMI polish — glass effect, progress bars, sections"
```

---

## Phase 5: Lane Backgrounds

### Task 5.1: Update LaneZoneNode with Stripe Pattern

**Files:**
- Modify: `components/features/LaneCalendar/nodes/LaneZoneNode.tsx`

**Step 1: Read current implementation**

First check the current structure of LaneZoneNode.

**Step 2: Update to use stripe pattern and tinted background**

```tsx
"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

export type LaneZoneData = {
  laneId: string;
  laneName: string;
  color: string;
  width: number;
  height: number;
};

function LaneZoneNodeComponent({ data }: NodeProps) {
  const { color, width, height } = data as LaneZoneData;

  // Convert hex to rgba for 10% opacity tint
  const tintColor = `${color}1A`;

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: tintColor,
        backgroundImage: "var(--lane-stripe)",
      }}
      className="rounded-lg pointer-events-none"
    />
  );
}

export const LaneZoneNode = memo(LaneZoneNodeComponent);
```

**Step 3: Visual verification**

Run: `npm run dev`

Open `/admin/shifts/schedule`:
- Lane backgrounds have subtle diagonal stripe pattern
- Lanes have faint color tint
- White shift cards "pop" on tinted backgrounds

**Step 4: Commit**

```bash
git add components/features/LaneCalendar/nodes/LaneZoneNode.tsx
git commit -m "feat(LaneZoneNode): KIMI stripe pattern and tinted backgrounds"
```

---

## Final Verification

### Task 6.1: Complete Visual Regression Check

**Step 1: Run full build**

```bash
npm run build
```

Expected: No build errors.

**Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

**Step 3: Visual checklist**

Run: `npm run dev`

Check each item:

- [ ] Shift blocks are white cards with left border accent
- [ ] Semantic zoom shows appropriate content at each level
- [ ] Desirability badges show correct colors (blue/gray/orange)
- [ ] Avatar stacks display overlapping gradient circles
- [ ] Template palette shows color stripes and hover states
- [ ] Properties panel has glass effect and progress bars
- [ ] Lane backgrounds show stripe pattern and tint
- [ ] Status badge pulses for OPEN_FOR_PREFERENCES and ASSIGNING
- [ ] Canvas background tints based on event status
- [ ] All drag/drop/resize/vote/assign functionality still works

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: UI design evolution complete — KIMI treatment applied"
```

---

## Phase 6: Documentation

### Task 6.2: Write DESIGN.md Reference Document

**Files:**
- Create: `docs/DESIGN.md`

**Step 1: Create the design system reference document**

```markdown
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
│██ Title                    [Score +]   │
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
- **KIMI Mockup:** `docs/260223_UImockup_ShiftAware_KIMI.html`

---

**Last Updated:** 2026-02-25
**Design System Version:** KIMI Treatment v1.0
```

**Step 2: Commit**

```bash
git add docs/DESIGN.md
git commit -m "docs: add DESIGN.md reference document for UI design system"
```

---

## Summary

**Files Created:**
- `components/ui/StatusBadge.tsx`
- `components/ui/ColorStripe.tsx`
- `components/ui/AvatarStack.tsx`
- `components/ui/DesirabilityBadge.tsx`
- `components/ui/GlassPanel.tsx`
- `components/ui/SectionLabel.tsx`
- `components/ui/ProgressBar.tsx`
- `docs/DESIGN.md`

**Files Modified:**
- `app/globals.css` — KIMI tokens, status theming CSS
- `app/admin/shifts/schedule/page.tsx` — status theming attribute
- `app/app/calendar/page.tsx` — status theming attribute
- `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx` — complete redesign
- `components/features/LaneCalendar/nodes/LaneZoneNode.tsx` — stripe pattern
- `components/features/TemplatePalette/TemplatePalette.tsx` — color stripes
- `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx` — glass polish

**Architecture:** Unchanged. Three-layer pattern, React Flow system, all hooks and data flow preserved.
