"use client";

import { useMemo } from "react";
import { format, eachDayOfInterval, startOfDay, addDays } from "date-fns";
import { LaneDropZone } from "./LaneDropZone";
import { ShiftBlock } from "./ShiftBlock";
import { DragPreview } from "./DragPreview";
import { LANES_ORDERED, getLaneLabel, getLaneColor } from "@/lib/types/lane";
import { cn } from "@/lib/utils";

interface Shift {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  capacity: number;
  assignments?: { id: string }[];
}

interface LaneCalendarViewProps {
  shifts: Shift[];
  startDate: Date;
  endDate: Date;
  /** Currently dragged template info (for DragPreview) */
  activeTemplate?: {
    type: string;
    durationMinutes: number;
  } | null;
  className?: string;
}

export function LaneCalendarView({
  shifts,
  startDate,
  endDate,
  activeTemplate,
  className,
}: LaneCalendarViewProps) {
  // Generate array of days
  const days = useMemo(() => {
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [startDate, endDate]);

  // Group shifts by lane type and date
  const shiftsByLaneAndDate = useMemo(() => {
    const grouped: Record<string, Record<string, Shift[]>> = {};

    for (const lane of LANES_ORDERED) {
      grouped[lane.type] = {};
      for (const day of days) {
        const dateStr = format(day, "yyyy-MM-dd");
        grouped[lane.type][dateStr] = [];
      }
    }

    for (const shift of shifts) {
      const dateStr = shift.startTime.split("T")[0];
      if (grouped[shift.type]?.[dateStr]) {
        grouped[shift.type][dateStr].push(shift);
      }
    }

    return grouped;
  }, [shifts, days]);

  return (
    <div className={cn("bg-white rounded-xl shadow-sm overflow-hidden", className)}>
      {/* Header row with days */}
      <div
        className="grid border-b border-gray-100 bg-gray-50"
        style={{
          gridTemplateColumns: `150px repeat(${days.length}, minmax(120px, 1fr))`,
        }}
      >
        <div className="p-3 font-bold text-xs text-gray-400 uppercase tracking-widest">
          Lane
        </div>
        {days.map((day) => (
          <div
            key={format(day, "yyyy-MM-dd")}
            className="p-3 text-center border-l border-gray-100"
          >
            <div className="text-xs font-bold text-gray-400 uppercase tracking-tighter">
              {format(day, "EEE")}
            </div>
            <div className="text-sm font-bold text-gray-700">
              {format(day, "MMM d")}
            </div>
          </div>
        ))}
      </div>

      {/* Lane rows */}
      {LANES_ORDERED.map((lane) => (
        <div
          key={lane.type}
          className="grid border-b border-gray-50 last:border-b-0"
          style={{
            gridTemplateColumns: `150px repeat(${days.length}, minmax(120px, 1fr))`,
          }}
        >
          {/* Lane label */}
          <div className="p-3 flex items-center gap-2 bg-gray-25">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getLaneColor(lane.type) }}
            />
            <span className="text-sm font-bold text-gray-700">
              {getLaneLabel(lane.type)}
            </span>
          </div>

          {/* Day cells for this lane */}
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayStart = startOfDay(day);
            const dayEnd = addDays(dayStart, 1);
            const dayShifts = shiftsByLaneAndDate[lane.type]?.[dateStr] ?? [];

            return (
              <LaneDropZone
                key={`${lane.type}-${dateStr}`}
                date={day}
                laneType={lane.type}
                existingShifts={shifts}
                className="border-l border-gray-100"
              >
                {dayShifts.map((shift) => (
                  <ShiftBlock
                    key={shift.id}
                    shift={shift}
                    dayStart={dayStart}
                    dayEnd={dayEnd}
                  />
                ))}
              </LaneDropZone>
            );
          })}
        </div>
      ))}

      {/* Drag preview overlay */}
      {activeTemplate && (
        <DragPreview
          durationMinutes={activeTemplate.durationMinutes}
          templateType={activeTemplate.type}
        />
      )}
    </div>
  );
}
