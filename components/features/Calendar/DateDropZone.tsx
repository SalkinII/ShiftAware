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
    isOver && "bg-primary-50 border-2 border-primary-300 border-dashed",
    className,
  );

  if (as === "th") {
    return (
      <th ref={setNodeRef} className={baseClasses}>
        {children}
      </th>
    );
  }

  if (as === "td") {
    return (
      <td ref={setNodeRef} className={baseClasses}>
        {children}
      </td>
    );
  }

  return (
    <div ref={setNodeRef} className={baseClasses}>
      {children}
    </div>
  );
}
