"use client";

import { useMemo } from "react";
import { useEventContext } from "./useEventContext";

interface EventConfig {
  bufferDaysBefore?: number;
  bufferDaysAfter?: number;
}

interface CurrentEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  config?: EventConfig;
}

interface UseCurrentEventReturn {
  event: CurrentEvent | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to get the current event.
 * Derives from useEventContext - gets the most recent non-completed event,
 * or fallback to the most recent event.
 * Used by sidebars and other components that need event info.
 */
export function useCurrentEvent(): UseCurrentEventReturn {
  const { events, loading } = useEventContext(false);

  const event = useMemo(() => {
    if (events.length === 0) return null;

    // Get the most recent event that's not completed
    const activeEvent = events.find(e => e.status !== "COMPLETED");
    if (activeEvent) return activeEvent as CurrentEvent;

    // Fallback to most recent event
    return events[events.length - 1] as CurrentEvent;
  }, [events]);

  return { event, loading, error: null };
}

/**
 * Format event dates for display (e.g., "Jun 26-29")
 */
export function formatEventDateRange(
  startDate: string,
  endDate: string,
): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}
