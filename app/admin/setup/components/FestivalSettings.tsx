"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useEventContext } from "@/lib/hooks/useEventContext";
import { unwrapApiResponse } from "@/lib/api-errors";

export function FestivalSettings() {
  const toast = useToast();
  const {
    selectedEventId,
    selectedEvent,
    events,
    loading,
    refreshEvents,
    setSelectedEventId,
  } = useEventContext(true);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    status: "PLANNING",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    if (isCreatingNew || !selectedEventId) {
      setFormData({
        name: "",
        status: "PLANNING",
        startDate: "",
        endDate: "",
      });
    } else {
      const event = events.find((e) => e.id === selectedEventId);
      if (event) {
        setFormData({
          name: event.name,
          status: event.status,
          startDate: event.startDate.split("T")[0],
          endDate: event.endDate.split("T")[0],
        });
      }
    }
  }, [selectedEventId, events, isCreatingNew]);

  async function handleSave() {
    if (!formData.name || !formData.startDate || !formData.endDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        startDate: formData.startDate,
        endDate: formData.endDate,
      };

      const url = isCreatingNew
        ? "/api/events"
        : `/api/events/${selectedEventId}`;

      const method = isCreatingNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const resData = await res.json();
        const result = unwrapApiResponse<{ id: string }>(resData);
        toast.success(isCreatingNew ? "Event created" : "Event updated");
        await refreshEvents();
        if (isCreatingNew) {
          const newId = result?.id;
          if (newId) setSelectedEventId(newId);
          setIsCreatingNew(false);
        }
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to save event");
      }
    } catch {
      toast.error("Failed to save event");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-gray-500">Loading events...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          Event Configuration
        </h3>
        <p className="text-sm text-gray-500">
          Create a new event or select an existing one to edit
        </p>
      </div>

      <div className="mb-6 flex items-center justify-between">
        {selectedEventId && !isCreatingNew ? (
          <h2 className="text-lg font-semibold text-gray-900">
            Editing: {selectedEvent?.name || "Loading..."}
          </h2>
        ) : !isCreatingNew ? (
          <p className="text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
            Select an event from the header, or create a new one
          </p>
        ) : (
          <h2 className="text-lg font-semibold text-gray-900">
            Create New Event
          </h2>
        )}
        <button
          type="button"
          onClick={() => setIsCreatingNew(!isCreatingNew)}
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          {isCreatingNew ? "Cancel" : "+ New Event"}
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Event Name"
            placeholder="e.g., Summer Festival 2026"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-700">
              Status
            </label>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-lg">
              <span className="text-sm font-medium text-gray-900 capitalize">
                {formData.status?.replace(/_/g, " ").toLowerCase() ||
                  "Planning"}
              </span>
          </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start Date"
            type="date"
            value={formData.startDate}
            onChange={(e) =>
              setFormData({ ...formData, startDate: e.target.value })
            }
            required
          />
          <Input
            label="End Date"
            type="date"
            value={formData.endDate}
            onChange={(e) =>
              setFormData({ ...formData, endDate: e.target.value })
            }
            required
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving
            ? "Saving..."
            : selectedEventId === "new"
              ? "Create Event"
              : "Update Event"}
        </Button>
      </div>
    </div>
  );
}
