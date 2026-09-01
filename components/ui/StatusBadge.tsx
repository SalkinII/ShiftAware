"use client";

import { cn } from "@/lib/utils";
import type { EventStatus } from "@prisma/client";
import { Pill } from "./Pill";

const STATUS_CONFIG: Record<
  EventStatus,
  {
    label: string;
    tone: "gray" | "sky" | "orange" | "green" | "amber";
    dotClass: string;
    pulse: boolean;
  }
> = {
  PLANNING: {
    label: "Planning",
    tone: "gray",
    dotClass: "bg-gray-500",
    pulse: false,
  },
  OPEN_FOR_PREFERENCES: {
    label: "Open for Preferences",
    tone: "sky",
    dotClass: "bg-sky-500",
    pulse: true,
  },
  ASSIGNING: {
    label: "Assigning",
    tone: "orange",
    dotClass: "bg-orange-500",
    pulse: true,
  },
  FINALIZED: {
    label: "Finalized",
    tone: "green",
    dotClass: "bg-green-500",
    pulse: false,
  },
  COMPLETED: {
    label: "Completed",
    tone: "gray",
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
    <Pill tone={config.tone} pulse={pulse && config.pulse} className={className}>
      <div className={cn("w-2 h-2 rounded-full", config.dotClass)} />
      {config.label}
    </Pill>
  );
}
