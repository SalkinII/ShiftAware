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
