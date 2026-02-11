// components/ui/EventSelector.tsx
"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Event {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface EventSelectorProps {
  events: Event[];
  selectedEventId: string | null;
  onSelect: (eventId: string | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function EventSelector({
  events,
  selectedEventId,
  onSelect,
  placeholder = "Select an event",
  className,
  disabled = false,
}: EventSelectorProps) {
  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className={cn("relative", className)}>
      <select
        value={selectedEventId || ""}
        onChange={(e) => onSelect(e.target.value || null)}
        disabled={disabled}
        className={cn(
          "appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-10",
          "text-sm font-medium text-gray-700",
          "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "cursor-pointer min-w-[200px]",
        )}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {events.map((event) => (
          <option key={event.id} value={event.id}>
            {event.name}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}
