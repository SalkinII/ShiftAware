// lib/hooks/useEventContext.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { unwrapApiResponse } from "@/lib/api-errors";

interface Event {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface EventContextState {
  selectedEventId: string | null;
  selectedEvent: Event | null;
  events: Event[];
  loading: boolean;
  setSelectedEventId: (id: string | null) => void;
  refreshEvents: () => Promise<void>;
}

const STORAGE_KEY_USER = "selectedEventId";
const STORAGE_KEY_ADMIN = "adminSelectedEventId";

export function useEventContext(isAdmin: boolean = false): EventContextState {
  const storageKey = isAdmin ? STORAGE_KEY_ADMIN : STORAGE_KEY_USER;

  const [selectedEventId, setSelectedEventIdState] = useState<string | null>(
    null,
  );
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
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

  const refreshEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        const eventsList = unwrapApiResponse<Event[]>(data) || [];
        setEvents(eventsList);
        return eventsList;
      }
    } catch (error) {
      console.error("Failed to load events:", error);
    }
    return [];
  }, []);

  // Load events and restore selection on mount
  useEffect(() => {
    async function init() {
      setLoading(true);
      const eventsList = await refreshEvents();

      const savedId = localStorage.getItem(storageKey);
      if (savedId && eventsList.some((e) => e.id === savedId)) {
        setSelectedEventIdState(savedId);
      }

      setLoading(false);
    }
    init();
  }, [storageKey, refreshEvents]);

  // Load selected event details when ID changes
  useEffect(() => {
    if (selectedEventId) {
      const event = events.find((e) => e.id === selectedEventId);
      setSelectedEvent(event || null);
    } else {
      setSelectedEvent(null);
    }
  }, [selectedEventId, events]);

  return {
    selectedEventId,
    selectedEvent,
    events,
    loading,
    setSelectedEventId,
    refreshEvents,
  };
}
