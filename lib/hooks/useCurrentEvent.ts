"use client";

import { useState, useEffect } from "react";

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
 * Hook to fetch the current event.
 * Used by sidebars and other components that need event info.
 */
export function useCurrentEvent(): UseCurrentEventReturn {
  const [event, setEvent] = useState<CurrentEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchEvent() {
      try {
        const res = await fetch("/api/events/current");
        if (!res.ok) {
          if (res.status === 404) {
            // No events - not an error, just empty state
            if (mounted) {
              setEvent(null);
              setLoading(false);
            }
            return;
          }
          throw new Error("Failed to fetch event");
        }
        const data = await res.json();
        if (mounted) {
          setEvent(data.data);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unknown error");
          setLoading(false);
        }
      }
    }

    fetchEvent();

    return () => {
      mounted = false;
    };
  }, []);

  return { event, loading, error };
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
