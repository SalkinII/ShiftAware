"use client";

import { useDroppable } from "@dnd-kit/core";
import { format, startOfDay, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { getLaneColor } from "@/lib/types/lane";

interface Shift {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
}

interface LaneDropZoneProps {
  date: Date;
  laneType: string;
  existingShifts: Shift[];
  className?: string;
  children?: React.ReactNode;
}

export function LaneDropZone({
  date,
  laneType,
  existingShifts,
  className,
  children,
}: LaneDropZoneProps) {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);

  // Filter shifts for this lane on this day
  const laneShifts = existingShifts.filter(
    (s) => s.type === laneType && s.startTime.startsWith(dateStr)
  );

  // Get snap targets (end times of existing shifts)
  const snapTargets = laneShifts.map((s) => new Date(s.endTime));

  const { isOver, setNodeRef, active } = useDroppable({
    id: `lane-${dateStr}-${laneType}`,
    data: {
      type: "lane",
      date: dateStr,
      laneType,
      dayStart,
      dayEnd,
      snapTargets,
    },
  });

  const laneColor = getLaneColor(laneType);

  return (
    <div
      ref={setNodeRef}
      data-testid={`lane-drop-${dateStr}-${laneType}`}
      className={cn(
        "relative min-h-[60px] transition-colors duration-150",
        isOver && "ring-2 ring-inset",
        className
      )}
      style={{
        backgroundColor: isOver ? `${laneColor}10` : undefined,
        // @ts-expect-error CSS custom property
        "--ring-color": isOver ? laneColor : undefined,
        ringColor: isOver ? laneColor : undefined,
      }}
    >
      {children}
    </div>
  );
}
