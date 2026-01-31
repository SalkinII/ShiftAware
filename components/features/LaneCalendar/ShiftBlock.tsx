"use client";

import { useState, useCallback } from 'react';
import { format, differenceInMinutes, addMinutes, subMinutes } from "date-fns";
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from "@/lib/utils";
import { getLaneColor } from "@/lib/types/lane";
import { ResizeHandle } from './ResizeHandle';

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

  const [tempStart, setTempStart] = useState<Date | null>(null);
  const [tempEnd, setTempEnd] = useState<Date | null>(null);

  const start = tempStart || new Date(shift.startTime);
  const end = tempEnd || new Date(shift.endTime);
  const color = getLaneColor(shift.type);

  // Calculate position as percentage of day
  const totalMinutes = differenceInMinutes(dayEnd, dayStart);
  const startMinutes = Math.max(0, differenceInMinutes(start, dayStart));
  const endMinutes = Math.min(totalMinutes, differenceInMinutes(end, dayStart));

  const left = (startMinutes / totalMinutes) * 100;
  const width = ((endMinutes - startMinutes) / totalMinutes) * 100;
  const pixelsPerMinute = 1; // Approximate, adjust based on actual container width

  const handleResizeStart = useCallback((deltaMinutes: number) => {
    const newStart = addMinutes(tempStart || new Date(shift.startTime), deltaMinutes);
    setTempStart(newStart);
  }, [tempStart, shift.startTime]);

  const handleResizeEnd = useCallback((deltaMinutes: number) => {
    const newEnd = addMinutes(tempEnd || new Date(shift.endTime), deltaMinutes);
    setTempEnd(newEnd);
  }, [tempEnd, shift.endTime]);

  const handleResizeComplete = useCallback(() => {
    if (tempStart || tempEnd) {
      onSave?.({
        startTime: tempStart || undefined,
        endTime: tempEnd || undefined,
      });
      setTempStart(null);
      setTempEnd(null);
    }
  }, [tempStart, tempEnd, onSave]);

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
        "absolute top-1 bottom-1 rounded-md shadow-sm flex items-center px-2 text-white text-xs font-medium overflow-hidden relative",
        isDraggable && "cursor-grab active:cursor-grabbing"
      )}
      style={style}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
      title={`${shift.type.replace(/_/g, " ")}\n${format(start, "HH:mm")} - ${format(end, "HH:mm")}\n${filled}/${shift.capacity} assigned`}
    >
      {isDraggable && (
        <>
          <ResizeHandle
            position="left"
            onResize={handleResizeStart}
            onResizeEnd={handleResizeComplete}
            pixelsPerMinute={pixelsPerMinute}
          />
          <ResizeHandle
            position="right"
            onResize={handleResizeEnd}
            onResizeEnd={handleResizeComplete}
            pixelsPerMinute={pixelsPerMinute}
          />
        </>
      )}
      <span className="truncate">
        {format(start, "HH:mm")} - {format(end, "HH:mm")}
      </span>
    </div>
  );
}
