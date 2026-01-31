# ShiftAware Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate ShiftAware from 14 pages to 7, fix LaneCalendarView issues, and establish a clean workflow.

**Architecture:** Phase-based approach - fix the core calendar first (Phase 1), then consolidate pages (Phase 2), then user flow (Phase 3), then dynamic attributes (Phase 4). Each phase is independently deployable.

**Tech Stack:** Next.js 14, React 18, TypeScript, Prisma, dnd-kit, Tailwind CSS, date-fns

**Worktree:** `D:\DIVERS\NoG-BastelProjekte\2026\ShiftAware\.worktrees\consolidation`

**Branch:** `feature/shiftaware-consolidation`

---

## Phase 1: LaneCalendarView Fixes (11 tasks)

### Task 1.1: Add Time Ruler Component

**Files:**
- Create: `components/features/LaneCalendar/TimeRuler.tsx`
- Test: `tests/components/TimeRuler.test.tsx`

**Step 1: Write the failing test**

```typescript
// tests/components/TimeRuler.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TimeRuler } from '@/components/features/LaneCalendar/TimeRuler';

describe('TimeRuler', () => {
  it('renders hour labels for given time range', () => {
    const startTime = new Date('2026-01-31T08:00:00');
    const endTime = new Date('2026-01-31T12:00:00');

    render(<TimeRuler startTime={startTime} endTime={endTime} />);

    expect(screen.getByText('08')).toBeInTheDocument();
    expect(screen.getByText('09')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('renders tick marks at 15-minute intervals', () => {
    const startTime = new Date('2026-01-31T08:00:00');
    const endTime = new Date('2026-01-31T09:00:00');

    const { container } = render(<TimeRuler startTime={startTime} endTime={endTime} />);

    // 4 ticks per hour (00, 15, 30, 45)
    const ticks = container.querySelectorAll('[data-testid="time-tick"]');
    expect(ticks.length).toBeGreaterThanOrEqual(4);
  });

  it('applies position="top" or position="bottom" styling', () => {
    const startTime = new Date('2026-01-31T08:00:00');
    const endTime = new Date('2026-01-31T10:00:00');

    const { rerender } = render(<TimeRuler startTime={startTime} endTime={endTime} position="top" />);
    expect(screen.getByTestId('time-ruler')).toHaveClass('border-b');

    rerender(<TimeRuler startTime={startTime} endTime={endTime} position="bottom" />);
    expect(screen.getByTestId('time-ruler')).toHaveClass('border-t');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/TimeRuler.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// components/features/LaneCalendar/TimeRuler.tsx
'use client';

import { eachHourOfInterval, format, differenceInMinutes } from 'date-fns';

interface TimeRulerProps {
  startTime: Date;
  endTime: Date;
  position?: 'top' | 'bottom';
}

export function TimeRuler({ startTime, endTime, position = 'top' }: TimeRulerProps) {
  const hours = eachHourOfInterval({ start: startTime, end: endTime });
  const totalMinutes = differenceInMinutes(endTime, startTime);

  return (
    <div
      data-testid="time-ruler"
      className={`relative h-8 bg-muted/50 ${position === 'top' ? 'border-b' : 'border-t'} border-border`}
    >
      {hours.map((hour, idx) => {
        const minutesFromStart = differenceInMinutes(hour, startTime);
        const leftPercent = (minutesFromStart / totalMinutes) * 100;

        return (
          <div key={hour.toISOString()} className="absolute top-0 h-full" style={{ left: `${leftPercent}%` }}>
            {/* Hour label */}
            <span className="absolute -translate-x-1/2 top-1 text-xs font-medium text-muted-foreground">
              {format(hour, 'HH')}
            </span>

            {/* Hour tick (tall) */}
            <div data-testid="time-tick" className="absolute bottom-0 w-px h-3 bg-border" />

            {/* 15-min ticks (short) - skip if last hour */}
            {idx < hours.length - 1 && [15, 30, 45].map(minutes => {
              const tickOffset = (minutes / totalMinutes) * 100;
              return (
                <div
                  key={minutes}
                  data-testid="time-tick"
                  className="absolute bottom-0 w-px h-1.5 bg-border/60"
                  style={{ left: `${tickOffset}%` }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/TimeRuler.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/TimeRuler.tsx tests/components/TimeRuler.test.tsx
git commit -m "feat(LaneCalendar): add TimeRuler component with 15-min ticks"
```

---

### Task 1.2: Add View Mode Controls

**Files:**
- Create: `components/features/LaneCalendar/ViewModeControls.tsx`
- Create: `lib/types/calendar-view.ts`
- Test: `tests/components/ViewModeControls.test.tsx`

**Step 1: Write the failing test**

```typescript
// tests/components/ViewModeControls.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ViewModeControls } from '@/components/features/LaneCalendar/ViewModeControls';

describe('ViewModeControls', () => {
  it('renders day/week/custom toggle buttons', () => {
    render(<ViewModeControls mode="day" onModeChange={() => {}} currentDate={new Date()} onDateChange={() => {}} />);

    expect(screen.getByRole('button', { name: /day/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /week/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /custom/i })).toBeInTheDocument();
  });

  it('highlights active mode', () => {
    render(<ViewModeControls mode="week" onModeChange={() => {}} currentDate={new Date()} onDateChange={() => {}} />);

    const weekButton = screen.getByRole('button', { name: /week/i });
    expect(weekButton).toHaveAttribute('data-active', 'true');
  });

  it('calls onModeChange when mode button clicked', () => {
    const onModeChange = vi.fn();
    render(<ViewModeControls mode="day" onModeChange={onModeChange} currentDate={new Date()} onDateChange={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /week/i }));
    expect(onModeChange).toHaveBeenCalledWith('week');
  });

  it('renders navigation arrows', () => {
    render(<ViewModeControls mode="day" onModeChange={() => {}} currentDate={new Date()} onDateChange={() => {}} />);

    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('displays current date in DD.MM.YYYY format', () => {
    const date = new Date('2026-01-31');
    render(<ViewModeControls mode="day" onModeChange={() => {}} currentDate={date} onDateChange={() => {}} />);

    expect(screen.getByText('31.01.2026')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/ViewModeControls.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3: Create types file**

```typescript
// lib/types/calendar-view.ts
export type ViewMode = 'day' | 'week' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ViewState {
  mode: ViewMode;
  currentDate: Date;
  customRange?: DateRange;
}
```

**Step 4: Write minimal implementation**

```typescript
// components/features/LaneCalendar/ViewModeControls.tsx
'use client';

import { format, addDays, subDays, addWeeks, subWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ViewMode, DateRange } from '@/lib/types/calendar-view';

interface ViewModeControlsProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  customRange?: DateRange;
  onCustomRangeChange?: (range: DateRange) => void;
}

export function ViewModeControls({
  mode,
  onModeChange,
  currentDate,
  onDateChange,
  customRange,
  onCustomRangeChange,
}: ViewModeControlsProps) {
  const handlePrevious = () => {
    if (mode === 'day') {
      onDateChange(subDays(currentDate, 1));
    } else if (mode === 'week') {
      onDateChange(subWeeks(currentDate, 1));
    }
    // Custom mode: handled by date picker
  };

  const handleNext = () => {
    if (mode === 'day') {
      onDateChange(addDays(currentDate, 1));
    } else if (mode === 'week') {
      onDateChange(addWeeks(currentDate, 1));
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 p-2 bg-background border-b">
      {/* Mode toggle */}
      <div className="flex gap-1 bg-muted rounded-md p-1">
        {(['day', 'week', 'custom'] as ViewMode[]).map((m) => (
          <Button
            key={m}
            variant={mode === m ? 'default' : 'ghost'}
            size="sm"
            data-active={mode === m}
            onClick={() => onModeChange(m)}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </Button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={handlePrevious} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="min-w-[100px] text-center font-medium">
          {format(currentDate, 'dd.MM.yyyy')}
        </span>

        <Button variant="outline" size="icon" onClick={handleNext} aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Date picker trigger (for jumping) */}
      <Button variant="outline" size="icon" aria-label="Pick date">
        <Calendar className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- tests/components/ViewModeControls.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add lib/types/calendar-view.ts components/features/LaneCalendar/ViewModeControls.tsx tests/components/ViewModeControls.test.tsx
git commit -m "feat(LaneCalendar): add ViewModeControls with day/week/custom modes"
```

---

### Task 1.3: Add Horizontal Scrolling Container

**Files:**
- Create: `components/features/LaneCalendar/ScrollableCalendar.tsx`
- Test: `tests/components/ScrollableCalendar.test.tsx`

**Step 1: Write the failing test**

```typescript
// tests/components/ScrollableCalendar.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScrollableCalendar } from '@/components/features/LaneCalendar/ScrollableCalendar';

describe('ScrollableCalendar', () => {
  it('renders with horizontal overflow scroll', () => {
    render(
      <ScrollableCalendar>
        <div>Content</div>
      </ScrollableCalendar>
    );

    const container = screen.getByTestId('scrollable-calendar');
    expect(container).toHaveClass('overflow-x-auto');
  });

  it('renders children within scrollable area', () => {
    render(
      <ScrollableCalendar>
        <div data-testid="child">Child content</div>
      </ScrollableCalendar>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('applies minWidth based on hoursVisible prop', () => {
    render(
      <ScrollableCalendar hoursVisible={24}>
        <div>Content</div>
      </ScrollableCalendar>
    );

    const inner = screen.getByTestId('scrollable-inner');
    // 24 hours * 60px per hour = 1440px minimum
    expect(inner).toHaveStyle({ minWidth: '1440px' });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/ScrollableCalendar.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// components/features/LaneCalendar/ScrollableCalendar.tsx
'use client';

import { ReactNode, useRef } from 'react';

interface ScrollableCalendarProps {
  children: ReactNode;
  hoursVisible?: number;
  pixelsPerHour?: number;
}

export function ScrollableCalendar({
  children,
  hoursVisible = 24,
  pixelsPerHour = 60
}: ScrollableCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const minWidth = hoursVisible * pixelsPerHour;

  return (
    <div
      ref={scrollRef}
      data-testid="scrollable-calendar"
      className="overflow-x-auto overflow-y-visible"
    >
      <div
        data-testid="scrollable-inner"
        style={{ minWidth: `${minWidth}px` }}
      >
        {children}
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/ScrollableCalendar.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/ScrollableCalendar.tsx tests/components/ScrollableCalendar.test.tsx
git commit -m "feat(LaneCalendar): add ScrollableCalendar container"
```

---

### Task 1.4: Fix Snap-to-Position Logic

**Files:**
- Modify: `lib/utils/snap.ts`
- Modify: `tests/snap.test.ts`

**Step 1: Add failing test for pointer-based snap**

```typescript
// Add to tests/snap.test.ts
describe('calculateTimeFromPosition - enhanced', () => {
  it('calculates time based on pointer X position within day bounds', () => {
    const dayStart = new Date('2026-01-31T00:00:00');
    const dayEnd = new Date('2026-01-31T23:59:59');

    // Pointer at 50% should give noon
    const result = calculateTimeFromPosition(0.5, dayStart, dayEnd);
    expect(result.getHours()).toBe(12);
  });

  it('does NOT default to 00:00 when dropped', () => {
    const dayStart = new Date('2026-01-31T00:00:00');
    const dayEnd = new Date('2026-01-31T23:59:59');

    // Pointer at 75% should give ~18:00, not 00:00
    const result = calculateTimeFromPosition(0.75, dayStart, dayEnd);
    expect(result.getHours()).toBeGreaterThan(0);
    expect(result.getHours()).toBe(18);
  });
});

describe('snapToShiftEnd', () => {
  it('snaps to nearest shift end within threshold', () => {
    const dropTime = new Date('2026-01-31T10:20:00');
    const existingShiftEnds = [
      new Date('2026-01-31T10:00:00'),
      new Date('2026-01-31T10:30:00'), // Within 30min threshold
      new Date('2026-01-31T14:00:00'),
    ];

    const result = snapToShiftEnd(dropTime, existingShiftEnds, 30);
    expect(result.snapped).toBe(true);
    expect(result.time.getHours()).toBe(10);
    expect(result.time.getMinutes()).toBe(30);
  });

  it('returns original time when no shift end within threshold', () => {
    const dropTime = new Date('2026-01-31T12:00:00');
    const existingShiftEnds = [
      new Date('2026-01-31T10:00:00'),
      new Date('2026-01-31T14:00:00'),
    ];

    const result = snapToShiftEnd(dropTime, existingShiftEnds, 30);
    expect(result.snapped).toBe(false);
    expect(result.time.getHours()).toBe(12);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/snap.test.ts`
Expected: FAIL - snapToShiftEnd not defined

**Step 3: Update snap.ts with enhanced functions**

```typescript
// lib/utils/snap.ts - add/update these functions

export interface SnapResult {
  time: Date;
  snapped: boolean;
  snapTarget?: Date;
}

/**
 * Snap to nearest shift end if within threshold
 */
export function snapToShiftEnd(
  dropTime: Date,
  shiftEndTimes: Date[],
  thresholdMinutes: number = 30
): SnapResult {
  let closestEnd: Date | null = null;
  let closestDistance = Infinity;

  for (const endTime of shiftEndTimes) {
    const distance = Math.abs(differenceInMinutes(dropTime, endTime));
    if (distance <= thresholdMinutes && distance < closestDistance) {
      closestDistance = distance;
      closestEnd = endTime;
    }
  }

  if (closestEnd) {
    return { time: closestEnd, snapped: true, snapTarget: closestEnd };
  }

  return { time: dropTime, snapped: false };
}

/**
 * Calculate time from relative X position (0-1) within day bounds
 * Fixed: properly calculates based on position, not defaulting to 00:00
 */
export function calculateTimeFromPosition(
  relativeX: number,
  dayStart: Date,
  dayEnd: Date
): Date {
  const totalMinutes = differenceInMinutes(dayEnd, dayStart);
  const minutesFromStart = Math.round(relativeX * totalMinutes);
  return addMinutes(dayStart, minutesFromStart);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/snap.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/utils/snap.ts tests/snap.test.ts
git commit -m "fix(snap): fix pointer-based time calculation, add snapToShiftEnd"
```

---

### Task 1.5: Add Template-to-Lane Validation

**Files:**
- Create: `lib/utils/lane-validation.ts`
- Modify: `prisma/schema.prisma` (add allowedLanes to ShiftTemplate)
- Test: `tests/lane-validation.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/lane-validation.test.ts
import { describe, it, expect } from 'vitest';
import { isValidLaneDrop, getTemplateAllowedLanes } from '@/lib/utils/lane-validation';
import { ShiftType } from '@prisma/client';

describe('lane-validation', () => {
  describe('isValidLaneDrop', () => {
    it('returns true when template allows the target lane', () => {
      const template = {
        id: '1',
        type: ShiftType.MOBILE_TEAM_1,
        allowedLanes: [ShiftType.MOBILE_TEAM_1, ShiftType.MOBILE_TEAM_2],
      };

      expect(isValidLaneDrop(template, ShiftType.MOBILE_TEAM_1)).toBe(true);
      expect(isValidLaneDrop(template, ShiftType.MOBILE_TEAM_2)).toBe(true);
    });

    it('returns false when template does not allow the target lane', () => {
      const template = {
        id: '1',
        type: ShiftType.MOBILE_TEAM_1,
        allowedLanes: [ShiftType.MOBILE_TEAM_1],
      };

      expect(isValidLaneDrop(template, ShiftType.EXECUTIVE)).toBe(false);
    });

    it('falls back to template type when allowedLanes is empty', () => {
      const template = {
        id: '1',
        type: ShiftType.STATIONARY,
        allowedLanes: [],
      };

      expect(isValidLaneDrop(template, ShiftType.STATIONARY)).toBe(true);
      expect(isValidLaneDrop(template, ShiftType.MOBILE_TEAM_1)).toBe(false);
    });
  });

  describe('getTemplateAllowedLanes', () => {
    it('returns allowedLanes if defined', () => {
      const template = {
        type: ShiftType.MOBILE_TEAM_1,
        allowedLanes: [ShiftType.MOBILE_TEAM_1, ShiftType.MOBILE_TEAM_2],
      };

      expect(getTemplateAllowedLanes(template)).toEqual([ShiftType.MOBILE_TEAM_1, ShiftType.MOBILE_TEAM_2]);
    });

    it('returns [type] as fallback', () => {
      const template = {
        type: ShiftType.EXECUTIVE,
        allowedLanes: [],
      };

      expect(getTemplateAllowedLanes(template)).toEqual([ShiftType.EXECUTIVE]);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lane-validation.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Update Prisma schema**

```prisma
// prisma/schema.prisma - update ShiftTemplate model
model ShiftTemplate {
  id               String              @id @default(cuid())
  name             String
  type             ShiftType
  allowedLanes     ShiftType[]         @default([])  // NEW: lanes this template can be dropped into
  durationMinutes  Int
  startTime        String?
  priority         ShiftPriority       @default(CORE)
  desirabilityScore Float              @default(1.0)
  capacity         Int                 @default(2)
  color            String?
  roles            ShiftTemplateRole[]
  scheduledShifts  ScheduledShift[]
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt
}
```

**Step 4: Write implementation**

```typescript
// lib/utils/lane-validation.ts
import { ShiftType } from '@prisma/client';

interface TemplateWithLanes {
  type: ShiftType;
  allowedLanes: ShiftType[];
}

/**
 * Check if dropping a template into a lane is valid
 */
export function isValidLaneDrop(template: TemplateWithLanes, targetLane: ShiftType): boolean {
  const allowedLanes = getTemplateAllowedLanes(template);
  return allowedLanes.includes(targetLane);
}

/**
 * Get the lanes a template can be dropped into
 * Falls back to template's own type if allowedLanes is empty
 */
export function getTemplateAllowedLanes(template: TemplateWithLanes): ShiftType[] {
  if (template.allowedLanes && template.allowedLanes.length > 0) {
    return template.allowedLanes;
  }
  return [template.type];
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- tests/lane-validation.test.ts`
Expected: PASS

**Step 6: Generate Prisma client and commit**

```bash
npx prisma generate
git add lib/utils/lane-validation.ts tests/lane-validation.test.ts prisma/schema.prisma
git commit -m "feat(lane): add template-to-lane validation with allowedLanes"
```

---

### Task 1.6: Update Schedule Page Drop Handler

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

**Step 1: Read current implementation**

Review the current `handleDragEnd` function in the schedule page.

**Step 2: Update to use lane validation (silent rejection)**

Find the `handleDragEnd` function and update it:

```typescript
// In handleDragEnd, add validation before creating shift:
import { isValidLaneDrop } from '@/lib/utils/lane-validation';

// Inside handleDragEnd, before the POST request:
const targetLane = droppableData.laneType as ShiftType;

// Validate drop - silent rejection if invalid
if (!isValidLaneDrop(activeTemplate, targetLane)) {
  return; // Silent rejection - no toast, no shift created
}

// Remove any existing toast.error for invalid lane drops
```

**Step 3: Test manually**

1. Start dev server: `npm run dev`
2. Navigate to `/admin/shifts/schedule`
3. Drag a MOBILE template over EXECUTIVE lane
4. Verify: No shift created, no toast shown
5. Drag same template over MOBILE lane
6. Verify: Shift created successfully

**Step 4: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "fix(schedule): silent rejection for invalid lane drops"
```

---

### Task 1.7: Add Shift Drag-to-Reposition

**Files:**
- Modify: `components/features/LaneCalendar/ShiftBlock.tsx`
- Modify: `components/features/LaneCalendar/LaneCalendarView.tsx`

**Step 1: Make ShiftBlock draggable**

Update ShiftBlock to use dnd-kit's `useDraggable`:

```typescript
// components/features/LaneCalendar/ShiftBlock.tsx
'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
// ... existing imports

interface ShiftBlockProps {
  shift: Shift;
  dayStart: Date;
  dayEnd: Date;
  isDraggable?: boolean; // NEW: enable drag for admin
}

export function ShiftBlock({ shift, dayStart, dayEnd, isDraggable = false }: ShiftBlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `shift-${shift.id}`,
    data: { type: 'shift', shift },
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    // ... existing positioning styles
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
      className={cn(
        'absolute rounded px-1 py-0.5 text-xs cursor-grab active:cursor-grabbing',
        // ... existing classes
      )}
    >
      {/* ... existing content */}
    </div>
  );
}
```

**Step 2: Handle shift repositioning in LaneCalendarView**

The parent already has `onDragEnd` handling - extend it to detect shift drags:

```typescript
// In handleDragEnd:
if (active.data.current?.type === 'shift') {
  const shift = active.data.current.shift;
  // Calculate new position from drop coordinates
  // PATCH /api/shifts/[id] with new startTime/endTime
}
```

**Step 3: Test manually**

1. Verify existing shifts can be dragged within their lane
2. Verify the shift updates its position after drop

**Step 4: Commit**

```bash
git add components/features/LaneCalendar/ShiftBlock.tsx components/features/LaneCalendar/LaneCalendarView.tsx
git commit -m "feat(LaneCalendar): add shift drag-to-reposition"
```

---

### Task 1.8: Add Shift Resize Handles

**Files:**
- Modify: `components/features/LaneCalendar/ShiftBlock.tsx`
- Create: `components/features/LaneCalendar/ResizeHandle.tsx`

**Step 1: Create ResizeHandle component**

```typescript
// components/features/LaneCalendar/ResizeHandle.tsx
'use client';

import { useCallback, useRef } from 'react';

interface ResizeHandleProps {
  position: 'left' | 'right';
  onResize: (deltaMinutes: number) => void;
  onResizeEnd: () => void;
  pixelsPerMinute: number;
}

export function ResizeHandle({ position, onResize, onResizeEnd, pixelsPerMinute }: ResizeHandleProps) {
  const startX = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    startX.current = e.clientX;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX.current;
      const deltaMinutes = Math.round(deltaX / pixelsPerMinute);
      if (deltaMinutes !== 0) {
        onResize(position === 'left' ? -deltaMinutes : deltaMinutes);
        startX.current = moveEvent.clientX;
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      onResizeEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onResize, onResizeEnd, pixelsPerMinute, position]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`absolute top-0 bottom-0 w-2 cursor-ew-resize hover:bg-primary/20 ${
        position === 'left' ? 'left-0' : 'right-0'
      }`}
    />
  );
}
```

**Step 2: Integrate into ShiftBlock**

```typescript
// In ShiftBlock.tsx, add resize handles when isDraggable:
{isDraggable && (
  <>
    <ResizeHandle
      position="left"
      onResize={(delta) => handleResizeStart(delta)}
      onResizeEnd={handleResizeEnd}
      pixelsPerMinute={pixelsPerMinute}
    />
    <ResizeHandle
      position="right"
      onResize={(delta) => handleResizeEnd(delta)}
      onResizeEnd={handleResizeEnd}
      pixelsPerMinute={pixelsPerMinute}
    />
  </>
)}
```

**Step 3: Commit**

```bash
git add components/features/LaneCalendar/ResizeHandle.tsx components/features/LaneCalendar/ShiftBlock.tsx
git commit -m "feat(LaneCalendar): add shift resize handles"
```

---

### Task 1.9: Add Click-to-Edit Popover

**Files:**
- Create: `components/features/LaneCalendar/ShiftEditPopover.tsx`
- Modify: `components/features/LaneCalendar/ShiftBlock.tsx`

**Step 1: Create ShiftEditPopover**

```typescript
// components/features/LaneCalendar/ShiftEditPopover.tsx
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';

interface ShiftEditPopoverProps {
  shift: {
    id: string;
    startTime: Date;
    endTime: Date;
    capacity: number;
  };
  onSave: (updates: { startTime?: Date; endTime?: Date; capacity?: number }) => void;
  onDelete: () => void;
  children: React.ReactNode;
}

export function ShiftEditPopover({ shift, onSave, onDelete, children }: ShiftEditPopoverProps) {
  const [startTime, setStartTime] = useState(format(shift.startTime, 'HH:mm'));
  const [endTime, setEndTime] = useState(format(shift.endTime, 'HH:mm'));
  const [capacity, setCapacity] = useState(shift.capacity);
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const newStart = new Date(shift.startTime);
    newStart.setHours(startH, startM, 0, 0);

    const newEnd = new Date(shift.endTime);
    newEnd.setHours(endH, endM, 0, 0);

    onSave({ startTime: newStart, endTime: newEnd, capacity });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Start Time</Label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>End Time</Label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Capacity</Label>
            <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          </div>
          <div className="flex justify-between">
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
            <Button size="sm" onClick={handleSave}>Save</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Wrap ShiftBlock content with popover**

```typescript
// In ShiftBlock.tsx, wrap the content:
return (
  <ShiftEditPopover shift={shift} onSave={handleSave} onDelete={handleDelete}>
    <div ref={setNodeRef} /* ... existing props */>
      {/* ... existing content */}
    </div>
  </ShiftEditPopover>
);
```

**Step 3: Commit**

```bash
git add components/features/LaneCalendar/ShiftEditPopover.tsx components/features/LaneCalendar/ShiftBlock.tsx
git commit -m "feat(LaneCalendar): add click-to-edit popover for shifts"
```

---

### Task 1.10: Add DD.MM.YYYY Date Headers

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarView.tsx`

**Step 1: Update date rendering**

Find where dates are rendered and update to use DD.MM.YYYY format:

```typescript
import { format } from 'date-fns';

// In the header rendering:
<div className="text-sm font-medium">
  {format(day, 'dd.MM.yyyy')}
</div>
<div className="text-xs text-muted-foreground">
  {format(day, 'EEEE')} {/* Day name */}
</div>
```

**Step 2: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarView.tsx
git commit -m "feat(LaneCalendar): show dates in DD.MM.YYYY format"
```

---

### Task 1.11: Integrate All Components into LaneCalendarView

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarView.tsx`
- Modify: `components/features/LaneCalendar/index.ts`

**Step 1: Update LaneCalendarView to compose all new components**

```typescript
// components/features/LaneCalendar/LaneCalendarView.tsx
'use client';

import { useState } from 'react';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, addMinutes } from 'date-fns';
import { ViewModeControls } from './ViewModeControls';
import { TimeRuler } from './TimeRuler';
import { ScrollableCalendar } from './ScrollableCalendar';
import { LaneDropZone } from './LaneDropZone';
import { ShiftBlock } from './ShiftBlock';
import { DragPreview } from './DragPreview';
import { LANES_ORDERED } from '@/lib/types/lane';
import { ViewMode } from '@/lib/types/calendar-view';

interface LaneCalendarViewProps {
  shifts: Shift[];
  onShiftCreate: (data: CreateShiftData) => void;
  onShiftUpdate: (id: string, data: UpdateShiftData) => void;
  onShiftDelete: (id: string) => void;
  isEditable?: boolean;
}

export function LaneCalendarView({
  shifts,
  onShiftCreate,
  onShiftUpdate,
  onShiftDelete,
  isEditable = false
}: LaneCalendarViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calculate time bounds based on view mode
  const { startTime, endTime } = useMemo(() => {
    switch (viewMode) {
      case 'day':
        return { startTime: startOfDay(currentDate), endTime: endOfDay(currentDate) };
      case 'week':
        return { startTime: startOfWeek(currentDate), endTime: endOfWeek(currentDate) };
      default:
        return { startTime: startOfDay(currentDate), endTime: endOfDay(currentDate) };
    }
  }, [viewMode, currentDate]);

  const hoursVisible = differenceInHours(endTime, startTime);

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <ViewModeControls
        mode={viewMode}
        onModeChange={setViewMode}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
      />

      {/* Calendar grid with scrolling */}
      <ScrollableCalendar hoursVisible={hoursVisible}>
        {/* Top time ruler */}
        <TimeRuler startTime={startTime} endTime={endTime} position="top" />

        {/* Lane rows */}
        <div className="flex flex-col">
          {LANES_ORDERED.map((lane) => (
            <LaneDropZone
              key={lane}
              laneType={lane}
              startTime={startTime}
              endTime={endTime}
            >
              {shifts
                .filter((s) => s.type === lane)
                .map((shift) => (
                  <ShiftBlock
                    key={shift.id}
                    shift={shift}
                    dayStart={startTime}
                    dayEnd={endTime}
                    isDraggable={isEditable}
                    onSave={(updates) => onShiftUpdate(shift.id, updates)}
                    onDelete={() => onShiftDelete(shift.id)}
                  />
                ))}
            </LaneDropZone>
          ))}
        </div>

        {/* Bottom time ruler */}
        <TimeRuler startTime={startTime} endTime={endTime} position="bottom" />
      </ScrollableCalendar>

      {/* Drag preview overlay */}
      <DragPreview />
    </div>
  );
}
```

**Step 2: Update exports**

```typescript
// components/features/LaneCalendar/index.ts
export { LaneCalendarView } from './LaneCalendarView';
export { TimeRuler } from './TimeRuler';
export { ViewModeControls } from './ViewModeControls';
export { ScrollableCalendar } from './ScrollableCalendar';
export { ShiftEditPopover } from './ShiftEditPopover';
export { ResizeHandle } from './ResizeHandle';
export { LaneDropZone } from './LaneDropZone';
export { ShiftBlock } from './ShiftBlock';
export { DragPreview } from './DragPreview';
```

**Step 3: Test the integrated view**

Run: `npm run dev`
Navigate to `/admin/shifts/schedule` and verify:
- [ ] Time ruler shows at top and bottom
- [ ] View mode toggle works (day/week)
- [ ] Navigation arrows work
- [ ] Dates show in DD.MM.YYYY format
- [ ] Horizontal scrolling works
- [ ] Shifts can be dragged
- [ ] Shifts can be resized
- [ ] Shifts can be clicked to edit

**Step 4: Commit**

```bash
git add components/features/LaneCalendar/
git commit -m "feat(LaneCalendar): integrate all improvements into main view"
```

---

## Phase 2: Page Consolidation (4 tasks)

### Task 2.1: Create Admin Setup Page (merge Festival + Templates)

**Files:**
- Create: `app/admin/setup/page.tsx`
- Create: `app/admin/setup/components/FestivalSettings.tsx`
- Create: `app/admin/setup/components/TemplateManager.tsx`
- Create: `app/admin/setup/components/AttributeDefinitions.tsx`

**Implementation:**
- Two-tab layout: "Event Settings" | "Shift Templates"
- Event Settings: merged from `/admin/festival/setup`
- Shift Templates: merged from `/admin/shifts/templates`
- Add new "Team Attributes" section for dynamic attribute definitions

**Commit:** `feat(admin): create consolidated Setup page`

---

### Task 2.2: Create Admin Team Page (merge Team + Allocation)

**Files:**
- Create: `app/admin/team/page.tsx`
- Move/refactor allocation logic
- Add distribution settings UI

**Implementation:**
- Two-tab layout: "Members" | "Allocation"
- Members: from `/admin/team/manage`
- Allocation: from `/admin/allocation` with editable distribution weights
- Add "Publish assignments" button

**Commit:** `feat(admin): create consolidated Team & Allocation page`

---

### Task 2.3: Update Schedule Page with Coverage Overlay

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`
- Create: `components/features/LaneCalendar/CoverageOverlay.tsx`

**Implementation:**
- Add toggle button for coverage overlay
- Overlay shows color-coded density (green→yellow→red)
- Add "Publish shifts" button

**Commit:** `feat(schedule): add coverage overlay and publish button`

---

### Task 2.4: Remove Deprecated Admin Pages

**Files:**
- Delete: `app/admin/festival/` (entire folder)
- Delete: `app/admin/shifts/templates/` (entire folder)
- Delete: `app/admin/coverage/` (entire folder)
- Delete: `app/admin/publish/` (entire folder)
- Update: `components/layout/AdminSidebar.tsx`

**Implementation:**
- Remove old page folders
- Update sidebar navigation to new routes
- Verify no broken imports

**Commit:** `refactor(admin): remove deprecated pages, update navigation`

---

## Phase 3: User Flow (4 tasks)

### Task 3.1: Create Identity Selection Page

**Files:**
- Create: `app/app/identity/page.tsx`
- Create: `app/app/identity/components/MemberList.tsx`
- Create: `app/app/identity/components/CreateProfileForm.tsx`

**Implementation:**
- List existing team members with voting status badges
- "Create new profile" option with dynamic attribute form
- Redirect to `/app/calendar` after selection

**Commit:** `feat(user): add identity selection page`

---

### Task 3.2: Update User Calendar with Toggle View

**Files:**
- Modify: `app/app/calendar/page.tsx`
- Create: `app/app/calendar/components/MyShiftsList.tsx`

**Implementation:**
- Default: "My shifts" simple list view
- Toggle to: "Full schedule" (LaneCalendarView, read-only)
- Highlight user's shifts in full view
- Inline preference voting (click shift → "I want/don't want")
- Inline swap request (click assigned shift → "Request swap")

**Commit:** `feat(user): add calendar toggle with inline actions`

---

### Task 3.3: Simplify Export Page (PNG only)

**Files:**
- Modify: `app/app/export/page.tsx`

**Implementation:**
- Remove PDF complexity
- Two buttons: "Export my shifts" | "Export full calendar"
- Generate PNG with html2canvas
- Add timestamp footer: `Export: DD.MM.YYYY HH:MM`

**Commit:** `refactor(export): simplify to PNG-only with timestamps`

---

### Task 3.4: Remove Deprecated User Pages

**Files:**
- Delete: `app/app/dashboard/` (entire folder)
- Delete: `app/app/vote/` (entire folder)
- Delete: `app/app/profile/` (entire folder)
- Delete: `app/app/swap/` (entire folder)
- Update: `components/layout/UserSidebar.tsx`

**Implementation:**
- Remove old page folders
- Update sidebar navigation to new routes
- Update login redirect to `/app/identity`

**Commit:** `refactor(user): remove deprecated pages, update navigation`

---

## Phase 4: Dynamic Attributes & Distribution (3 tasks)

### Task 4.1: Add Attribute Schema to Prisma

**Files:**
- Modify: `prisma/schema.prisma`
- Create migration

**Implementation:**
```prisma
model EventAttributeDefinition {
  id        String   @id @default(cuid())
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id])
  name      String   // e.g., "can_drive"
  label     String   // e.g., "Can Drive"
  type      AttributeType // BOOLEAN, SELECT, MULTISELECT
  options   String[] // For SELECT/MULTISELECT
  required  Boolean  @default(false)
}

model TeamMemberAttribute {
  id           String     @id @default(cuid())
  memberId     String
  member       TeamMember @relation(fields: [memberId], references: [id])
  definitionId String
  definition   EventAttributeDefinition @relation(fields: [definitionId], references: [id])
  value        String     // JSON-encoded value
}

enum AttributeType {
  BOOLEAN
  SELECT
  MULTISELECT
  TEXT
}
```

**Commit:** `feat(schema): add dynamic attribute definitions`

---

### Task 4.2: Create Attribute Definition UI

**Files:**
- Extend: `app/admin/setup/components/AttributeDefinitions.tsx`
- Create: `components/ui/AttributeFieldEditor.tsx`

**Implementation:**
- Admin can add/remove attribute definitions
- Define name, label, type, options (for select/multiselect)
- Mark as required or optional

**Commit:** `feat(setup): add attribute definition UI`

---

### Task 4.3: Add Distribution Logic UI

**Files:**
- Create: `app/admin/team/components/DistributionSettings.tsx`
- Create: `components/features/AllocationLogicPopover.tsx`

**Implementation:**
- Sliders/inputs for: fairness weight, preference weight
- Attribute rules builder: "EXECUTIVE requires experience = senior"
- Constraints: max shifts per person, min rest hours
- Preview button to see algorithm results
- User-facing popup explaining how allocation works

**Commit:** `feat(allocation): add editable distribution logic UI`

---

## Verification Checklist

After all phases complete, verify:

- [ ] Admin can plan dense shifts with hour-by-hour precision
- [ ] Shifts snap to previous shift ends seamlessly
- [ ] Templates only drop into their allowed lanes (silent rejection)
- [ ] Shifts are editable: drag, resize, click-to-edit
- [ ] Time rulers show at top and bottom with 15-min ticks
- [ ] View modes work: day, week, custom
- [ ] Navigation works: arrows, date picker
- [ ] Users select identity every login
- [ ] Users can toggle between simple and full calendar view
- [ ] Export produces clean PNG with timestamp
- [ ] Page count reduced from 14 to 7
- [ ] No hardcoded team attributes
- [ ] Distribution logic is editable
- [ ] All existing tests still pass

---

## File Summary

**New files:** 15
**Modified files:** 12
**Deleted files:** 8 folders

**Commits:** ~20 (one per task)
