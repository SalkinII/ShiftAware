"use client";

import { useDroppable } from "@dnd-kit/core";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DateDropZoneProps {
  date: Date;
  className?: string;
  children?: React.ReactNode;
  as?: "div" | "th" | "td";
}

export function DateDropZone({
  date,
  className,
  children,
  as = "div",
}: DateDropZoneProps) {
  const dateStr = format(date, "yyyy-MM-dd");
  const { isOver, setNodeRef } = useDroppable({
    id: `date-${dateStr}`,
    data: {
      type: "date",
      date: dateStr,
    },
  });

  const baseClasses = cn(
    "transition-colors duration-200",
    isOver && "bg-primary-50/30 border border-primary-400",
    className,
  );

  // Show date/time tooltip when dragging over
  const showTooltip = isOver;

  const dateDisplay = format(date, "MMM d");
  const timeDisplay = format(date, "HH:mm");

  if (as === "th") {
    return (
      <th
        ref={setNodeRef}
        className={baseClasses}
        title={isOver ? `Drop here: ${dateDisplay} ${timeDisplay}` : undefined}
      >
        {children}
        {showTooltip && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="text-xs font-bold text-primary-700 px-2 py-1 bg-white rounded shadow-lg border border-primary-300">
              {dateDisplay} {timeDisplay}
            </div>
          </div>
        )}
      </th>
    );
  }

  if (as === "td") {
    return (
      <td
        ref={setNodeRef}
        className={cn(baseClasses, "relative")}
        title={isOver ? `Drop here: ${dateDisplay}` : undefined}
      >
        {children}
        {showTooltip && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="text-xs font-bold text-primary-700 px-2 py-1 bg-white rounded shadow-lg border border-primary-300">
              {dateDisplay}
            </div>
          </div>
        )}
      </td>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(baseClasses, "relative")}
      title={isOver ? `Drop here: ${dateDisplay} ${timeDisplay}` : undefined}
    >
      {children}
      {showTooltip && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="text-xs font-bold text-primary-700 px-2 py-1 bg-white rounded shadow-lg border border-primary-300">
            {dateDisplay} {timeDisplay}
          </div>
        </div>
      )}
    </div>
  );
}
