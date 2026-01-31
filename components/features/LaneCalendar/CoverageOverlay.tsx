'use client';

import { useMemo } from 'react';
import { format, eachHourOfInterval, startOfDay, endOfDay } from 'date-fns';

interface Shift {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  capacity: number;
  assignments?: { id: string }[];
}

interface CoverageOverlayProps {
  shifts: Shift[];
  date: Date;
}

export function CoverageOverlay({ shifts, date }: CoverageOverlayProps) {
  const hours = eachHourOfInterval({
    start: startOfDay(date),
    end: endOfDay(date),
  });

  // Calculate coverage for each hour
  const coverage = useMemo(() => {
    return hours.map((hour) => {
      const hourEnd = new Date(hour.getTime() + 60 * 60 * 1000);

      // Count shifts that overlap with this hour
      const overlappingShifts = shifts.filter((shift) => {
        const shiftStart = new Date(shift.startTime);
        const shiftEnd = new Date(shift.endTime);
        return shiftStart < hourEnd && shiftEnd > hour;
      });

      const totalCapacity = overlappingShifts.reduce((sum, s) => sum + s.capacity, 0);
      const totalAssigned = overlappingShifts.reduce(
        (sum, s) => sum + (s.assignments?.length || 0),
        0
      );

      // Calculate coverage percentage
      const percentage = totalCapacity > 0 ? (totalAssigned / totalCapacity) * 100 : 0;

      // Determine color based on coverage
      let color = 'rgba(34, 197, 94, 0.2)'; // green
      if (percentage < 50) {
        color = 'rgba(239, 68, 68, 0.2)'; // red
      } else if (percentage < 80) {
        color = 'rgba(234, 179, 8, 0.2)'; // yellow
      }

      return {
        hour,
        totalCapacity,
        totalAssigned,
        percentage,
        color,
      };
    });
  }, [hours, shifts]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="relative h-full flex">
        {coverage.map((item, idx) => (
          <div
            key={idx}
            className="flex-1 border-r border-gray-100 last:border-r-0"
            style={{ backgroundColor: item.color }}
            title={`${format(item.hour, 'HH:00')}: ${item.totalAssigned}/${item.totalCapacity} (${Math.round(item.percentage)}%)`}
          />
        ))}
      </div>
    </div>
  );
}
