"use client";

import { format, differenceInMinutes, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { getLaneColor } from "@/lib/types/lane";

interface ShiftBlockProps {
  shift: {
    id: string;
    type: string;
    startTime: string;
    endTime: string;
    capacity: number;
    assignments?: { id: string }[];
  };
  dayStart: Date;
  dayEnd: Date;
}

export function ShiftBlock({ shift, dayStart, dayEnd }: ShiftBlockProps) {
  const start = new Date(shift.startTime);
  const end = new Date(shift.endTime);
  const color = getLaneColor(shift.type);

  // Calculate position as percentage of day
  const totalMinutes = differenceInMinutes(dayEnd, dayStart);
  const startMinutes = Math.max(0, differenceInMinutes(start, dayStart));
  const endMinutes = Math.min(totalMinutes, differenceInMinutes(end, dayStart));

  const left = (startMinutes / totalMinutes) * 100;
  const width = ((endMinutes - startMinutes) / totalMinutes) * 100;

  const filled = shift.assignments?.length ?? 0;
  const isFull = filled >= shift.capacity;

  return (
    <div
      className="absolute top-1 bottom-1 rounded-md shadow-sm flex items-center px-2 text-white text-xs font-medium overflow-hidden"
      style={{
        left: `${left}%`,
        width: `${Math.max(width, 5)}%`,
        backgroundColor: color,
        opacity: isFull ? 1 : 0.75,
      }}
      title={`${shift.type.replace(/_/g, " ")}\n${format(start, "HH:mm")} - ${format(end, "HH:mm")}\n${filled}/${shift.capacity} assigned`}
    >
      <span className="truncate">
        {format(start, "HH:mm")} - {format(end, "HH:mm")}
      </span>
    </div>
  );
}
