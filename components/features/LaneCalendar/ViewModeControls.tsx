'use client';

import { format, addDays, subDays, addWeeks, subWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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
            variant={mode === m ? 'primary' : 'ghost'}
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
        <Button variant="secondary" size="sm" onClick={handlePrevious} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="min-w-[100px] text-center font-medium">
          {format(currentDate, 'dd.MM.yyyy')}
        </span>

        <Button variant="secondary" size="sm" onClick={handleNext} aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Date picker trigger (for jumping) */}
      <Button variant="secondary" size="sm" aria-label="Pick date">
        <Calendar className="h-4 w-4" />
      </Button>
    </div>
  );
}
