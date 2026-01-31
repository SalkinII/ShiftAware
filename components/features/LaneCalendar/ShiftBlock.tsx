"use client";

import { format, differenceInMinutes, startOfDay } from "date-fns";
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
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
  isDraggable?: boolean;
  onSave?: (updates: { startTime?: Date; endTime?: Date; capacity?: number }) => void;
  onDelete?: () => void;
}

export function ShiftBlock({ shift, dayStart, dayEnd, isDraggable = false, onSave, onDelete }: ShiftBlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `shift-${shift.id}`,
    data: { type: 'shift', shift },
    disabled: !isDraggable,
  });
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

  const style = {
    left: `${left}%`,
    width: `${Math.max(width, 5)}%`,
    backgroundColor: color,
    opacity: isDragging ? 0.5 : (isFull ? 1 : 0.75),
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute top-1 bottom-1 rounded-md shadow-sm flex items-center px-2 text-white text-xs font-medium overflow-hidden",
        isDraggable && "cursor-grab active:cursor-grabbing"
      )}
      style={style}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
      title={`${shift.type.replace(/_/g, " ")}\n${format(start, "HH:mm")} - ${format(end, "HH:mm")}\n${filled}/${shift.capacity} assigned`}
    >
      <span className="truncate">
        {format(start, "HH:mm")} - {format(end, "HH:mm")}
      </span>
    </div>
  );
}
