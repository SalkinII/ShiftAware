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
