"use client";

import { useDroppable } from "@dnd-kit/core";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DateDropZoneProps {
  date: Date;
  className?: string;
  children?: React.ReactNode;
}

export function DateDropZone({ date, className, children }: DateDropZoneProps) {
  const dateStr = format(date, "yyyy-MM-dd");
  const { isOver, setNodeRef } = useDroppable({
    id: `date-${dateStr}`,
    data: {
      type: "date",
      date: dateStr,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "transition-colors duration-200",
        isOver && "bg-primary-50 border-2 border-primary-300 border-dashed",
        className,
      )}
    >
      {children}
    </div>
  );
}
