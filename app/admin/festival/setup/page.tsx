"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { useToast } from "@/components/ui/Toast";

interface Event {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface EventConfig {
  id?: string;
  eventId?: string;
  minShiftsPerPerson: number;
  bufferDaysBefore: number;
  bufferDaysAfter: number;
  algorithmWeights: Record<string, number>;
  balanceThresholds: Record<string, number>;
  autoAssignUnfilled: boolean;
}

interface EventWithConfig {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  config: EventConfig | null;
  _count?: { shifts: number };
}

export default function FestivalSetupPage() {
  const [events, setEvents] = useState<EventWithConfig[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [config, setConfig] = useState<EventConfig>({
    minShiftsPerPerson: 2,
    bufferDaysBefore: 1,
    bufferDaysAfter: 1,
    algorithmWeights: {},
    balanceThresholds: {},
    autoAssignUnfilled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  // Fetch all events on mount
  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch("/api/events");
        if (res.ok) {
          const data = await res.json();
          setEvents(data.data || []);
          if (data.data?.length > 0) {
            setSelectedEventId(data.data[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch events:", error);
        toast.error("Failed to load events");
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, [toast]);

  // Fetch config when event changes
  useEffect(() => {
    if (!selectedEventId) return;

    async function fetchConfig() {
      try {
        const res = await fetch(`/api/events/${selectedEventId}/config`);
        if (res.ok) {
          const data = await res.json();
          if (data.data?.config) {
            setConfig(data.data.config);
          } else if (data.data?.defaults) {
            setConfig(data.data.defaults);
          }
        }
      } catch (error) {
        console.error("Failed to fetch config:", error);
      }
    }
    fetchConfig();
  }, [selectedEventId]);

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  async function handleSave() {
    if (!selectedEventId) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        toast.success("Configuration saved");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to save");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Festival Setup</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure event dates, buffers, and algorithm settings
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No events found. Create an event first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Festival Setup</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure event dates, buffers, and algorithm settings
        </p>
      </div>

      {/* Event Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Event
        </label>
        <select
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name} ({format(new Date(event.startDate), "MMM d")} -{" "}
              {format(new Date(event.endDate), "MMM d, yyyy")})
            </option>
          ))}
        </select>
      </div>

      {selectedEvent && (
        <>
          {/* Event Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Event Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  Event Name
                </label>
                <p className="text-gray-900 font-medium">{selectedEvent.name}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  Start Date
                </label>
                <p className="text-gray-900">
                  {format(new Date(selectedEvent.startDate), "EEEE, MMMM d, yyyy")}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  End Date
                </label>
                <p className="text-gray-900">
                  {format(new Date(selectedEvent.endDate), "EEEE, MMMM d, yyyy")}
                </p>
              </div>
            </div>
          </div>

          {/* Buffer Configuration */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Calendar Buffer Days
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Buffer days extend the calendar view before and after the event for
              setup/teardown shifts.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Days Before Event
                </label>
                <input
                  type="number"
                  min="0"
                  max="14"
                  value={config.bufferDaysBefore}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      bufferDaysBefore: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Days After Event
                </label>
                <input
                  type="number"
                  min="0"
                  max="14"
                  value={config.bufferDaysAfter}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      bufferDaysAfter: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Algorithm Settings */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Assignment Settings
            </h2>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Shifts per Person
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={config.minShiftsPerPerson}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      minShiftsPerPerson: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="autoAssign"
                  checked={config.autoAssignUnfilled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      autoAssignUnfilled: e.target.checked,
                    })
                  }
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="autoAssign" className="text-sm text-gray-700">
                  Auto-assign unfilled shifts randomly
                </label>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:ring-4 focus:ring-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
