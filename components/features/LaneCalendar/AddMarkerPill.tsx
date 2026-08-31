"use client";

import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function AddMarkerPill() {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/shiftaware-marker", JSON.stringify({ durationMinutes: 30 }));
        e.dataTransfer.effectAllowed = "copy";
        setIsDragging(true);
      }}
      onDragEnd={() => setIsDragging(false)}
      className={cn(
        "group flex items-center gap-2 px-3 py-1.5 rounded-lg",
        "bg-white hover:bg-gray-50 cursor-grab active:cursor-grabbing",
        "border border-transparent hover:border-gray-200 transition-colors shrink-0",
        isDragging && "opacity-50",
      )}
    >
      <GripVertical className="w-3 h-3 text-gray-400 shrink-0" />
      <span className="font-medium text-xs text-gray-900">📝 Add Note</span>
    </div>
  );
}
