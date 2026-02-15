"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getLaneColor } from "@/lib/types/lane";
import { useToast } from "@/components/ui/Toast";

interface ShiftPropertiesPanelProps {
  shiftId: string;
  onClose: () => void;
  onUpdated: () => void;
}

export function ShiftPropertiesPanel({
  shiftId,
  onClose,
  onUpdated,
}: ShiftPropertiesPanelProps) {
  const toast = useToast();
  const [shift, setShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [capacity, setCapacity] = useState(2);

  useEffect(() => {
    async function fetchShift() {
      setLoading(true);
      const res = await fetch(`/api/shifts/${shiftId}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setShift(data);
        setStartTime(format(new Date(data.startTime), "yyyy-MM-dd'T'HH:mm"));
        setEndTime(format(new Date(data.endTime), "yyyy-MM-dd'T'HH:mm"));
        setCapacity(data.capacity);
      }
      setLoading(false);
    }
    fetchShift();
  }, [shiftId]);

  const handleSave = async () => {
    setSaving(true);
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

    const res = await fetch(`/api/shifts/${shiftId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: shiftId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        durationMinutes,
        capacity,
      }),
    });

    setSaving(false);
    if (res.ok) {
      toast.success("Shift updated");
      window.dispatchEvent(
        new CustomEvent("shiftaware:cache-invalidate", {
          detail: { keys: ["shifts", "shifts*"] },
        }),
      );
      onUpdated();
    } else {
      toast.error("Failed to update shift");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this shift?")) return;

    const res = await fetch(`/api/shifts/${shiftId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Shift deleted");
      window.dispatchEvent(
        new CustomEvent("shiftaware:cache-invalidate", {
          detail: { keys: ["shifts", "shifts*"] },
        }),
      );
      onClose();
      onUpdated();
    } else {
      toast.error("Failed to delete shift");
    }
  };

  if (loading) {
    return <Card className="p-4 animate-pulse"><div className="h-40 bg-gray-100 rounded" /></Card>;
  }

  if (!shift) {
    return <Card className="p-4 text-gray-500">Shift not found</Card>;
  }

  return (
    <Card className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 rounded"
          style={{ backgroundColor: getLaneColor(shift.type) }}
        />
        <h3 className="font-semibold text-sm">{shift.type.replace("_", " ")}</h3>
        <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 text-xs">
          Close
        </button>
      </div>

      {/* Time inputs */}
      <div className="space-y-2">
        <label className="block text-xs text-gray-600">
          Start
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1 block w-full border rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs text-gray-600">
          End
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="mt-1 block w-full border rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs text-gray-600">
          Capacity
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
            className="mt-1 block w-full border rounded px-2 py-1 text-sm"
          />
        </label>
      </div>

      {/* Assigned members */}
      {shift.assignments?.length > 0 && (
        <div>
          <div className="text-xs text-gray-600 mb-1">
            Assigned ({shift.assignments.length}/{shift.capacity})
          </div>
          <ul className="space-y-1">
            {shift.assignments.map((a: any) => (
              <li key={a.id} className="text-xs text-gray-700 flex items-center gap-1">
                <span>{a.teamMember?.alias || "Unknown"}</span>
                <span className="text-gray-400">({a.role})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          className="text-xs"
        >
          Delete
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="text-xs ml-auto"
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </Card>
  );
}
