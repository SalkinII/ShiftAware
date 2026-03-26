"use client";

import { cn } from "@/lib/utils";
import type { EventStatus } from "@prisma/client";

const STATUS_CONFIG: Record<
  EventStatus,
  {
    label: string;
    classes: string;
    dotClass: string;
    pulse: boolean;
  }
> = {
  PLANNING: {
    label: "Planning",
    classes: "bg-gray-50 text-gray-700 border-gray-200",
    dotClass: "bg-gray-500",
    pulse: false,
  },
  OPEN_FOR_PREFERENCES: {
    label: "Open for Preferences",
    classes: "bg-sky-50 text-sky-700 border-sky-200",
    dotClass: "bg-sky-500",
    pulse: true,
  },
  ASSIGNING: {
    label: "Assigning",
    classes: "bg-orange-50 text-orange-700 border-orange-200",
    dotClass: "bg-orange-500",
    pulse: true,
  },
  FINALIZED: {
    label: "Finalized",
    classes: "bg-green-50 text-green-700 border-green-200",
    dotClass: "bg-green-500",
    pulse: false,
  },
  COMPLETED: {
    label: "Completed",
    classes: "bg-gray-50 text-gray-500 border-gray-200",
    dotClass: "bg-gray-400",
    pulse: false,
  },
};

interface StatusBadgeProps {
  status: EventStatus;
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  pulse = true,
  className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border",
        config.classes,
        pulse && config.pulse && "animate-pulse",
        className,
      )}
    >
      <div className={cn("w-2 h-2 rounded-full", config.dotClass)} />
      {config.label}
    </div>
  );
}
