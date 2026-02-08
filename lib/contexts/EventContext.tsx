"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { unwrapApiResponse } from "@/lib/api-errors";

export interface EventContextEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  config?: {
    bufferDaysBefore?: number;
    bufferDaysAfter?: number;
    minShiftsPerPerson?: number;
    [key: string]: unknown;
  };
  _count?: {
    shifts?: number;
    [key: string]: unknown;
  };
}

export interface EventContextState {
  selectedEventId: string | null;
  selectedEvent: EventContextEvent | null;
  events: EventContextEvent[];
  loading: boolean;
  setSelectedEventId: (id: string | null) => void;
  refreshEvents: () => Promise<void>;
}

const EventContext = createContext<EventContextState | null>(null);

const STORAGE_KEY_USER = "selectedEventId";
const STORAGE_KEY_ADMIN = "adminSelectedEventId";

interface EventContextProviderProps {
  isAdmin: boolean;
  children: React.ReactNode;
}

export function EventContextProvider({
  isAdmin,
  children,
}: EventContextProviderProps) {
  const storageKey = isAdmin ? STORAGE_KEY_ADMIN : STORAGE_KEY_USER;

  const [selectedEventId, setSelectedEventIdState] = useState<string | null>(
    null,
  );
  const [selectedEvent, setSelectedEvent] = useState<EventContextEvent | null>(
    null,
  );
  const [events, setEvents] = useState<EventContextEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const setSelectedEventId = useCallback(
    (id: string | null) => {
      setSelectedEventIdState(id);
      if (id) {
        localStorage.setItem(storageKey, id);
      } else {
        localStorage.removeItem(storageKey);
      }
    },
    [storageKey],
  );

  const refreshEvents = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        const eventsList = unwrapApiResponse<EventContextEvent[]>(data) || [];
        setEvents(eventsList);
      }
    } catch (error) {
      console.error("Failed to load events:", error);
    }
  }, []);

  // Load events on mount
  useEffect(() => {
    async function init() {
      setLoading(true);
      await refreshEvents();
      setLoading(false);
    }
    init();
  }, [refreshEvents]);

  // Restore selection after events are loaded
  useEffect(() => {
    if (events.length > 0 && !selectedEventId) {
      const savedId = localStorage.getItem(storageKey);
      if (savedId && events.some((e) => e.id === savedId)) {
        setSelectedEventIdState(savedId);
      }
    }
  }, [events, storageKey, selectedEventId]);

  // Update selectedEvent when ID or events list changes
  useEffect(() => {
    if (selectedEventId) {
      const event = events.find((e) => e.id === selectedEventId);
      setSelectedEvent(event || null);
    } else {
      setSelectedEvent(null);
    }
  }, [selectedEventId, events]);

  return (
    <EventContext.Provider
      value={{
        selectedEventId,
        selectedEvent,
        events,
        loading,
        setSelectedEventId,
        refreshEvents,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

/**
 * Consumer hook — must be used within EventContextProvider.
 * The `isAdmin` parameter is accepted for backward compatibility but ignored;
 * admin vs user behavior is determined by the provider wrapping the layout.
 */
export function useEventContext(_isAdmin?: boolean): EventContextState {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error(
      "useEventContext must be used within an EventContextProvider",
    );
  }
  return context;
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
