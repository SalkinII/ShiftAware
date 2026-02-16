"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getLaneColor } from "@/lib/types/lane";
import { useToast } from "@/components/ui/Toast";
import { canManuallyAssign } from "@/lib/services/event-status-permissions";
import type { EventStatus } from "@prisma/client";

interface ShiftPropertiesPanelProps {
  shiftId: string;
  eventStatus?: string;
  onClose: () => void;
  onUpdated: () => void;
}

export function ShiftPropertiesPanel({
  shiftId,
  eventStatus,
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
  const [availableMembers, setAvailableMembers] = useState<any[]>([]);
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState("");

  const canManualAssign = eventStatus
    ? canManuallyAssign(eventStatus as EventStatus)
    : false;

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

  useEffect(() => {
    fetchShift();
  }, [shiftId]);

  useEffect(() => {
    if (!shift?.eventId) return;
    fetch(`/api/members?eventId=${shift.eventId}`)
      .then((r) => r.json())
      .then((json) => {
        const members = json.data || json;
        const assignedIds = new Set(
          (shift.assignments || []).map((a: any) => a.teamMemberId),
        );
        setAvailableMembers(members.filter((m: any) => !assignedIds.has(m.id)));
      })
      .catch(() => setAvailableMembers([]));
  }, [shift]);

  const handleSave = async () => {
    setSaving(true);
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMinutes = Math.round(
      (end.getTime() - start.getTime()) / 60000,
    );

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
          detail: { keys: ["shifts", "shifts:*"] },
        }),
      );
      onUpdated();
    } else {
      if (res.status === 403) {
        toast.error("Shifts can't be edited in the current event state");
      } else {
        toast.error("Failed to update shift");
      }
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm("Remove this assignment?")) return;
    const res = await fetch(`/api/assignments?id=${assignmentId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Assignment removed");
      fetchShift();
      onUpdated();
    } else {
      toast.error("Failed to remove assignment");
    }
  };

  const handleAddAssignment = async () => {
    if (!selectedMemberToAdd || !shift) return;
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: shift.eventId,
        assignments: [
          {
            shiftId: shiftId,
            teamMemberId: selectedMemberToAdd,
            role: "TEAM_MEMBER",
            assignmentType: "MANUAL",
          },
        ],
      }),
    });
    if (res.ok) {
      toast.success("Member assigned");
      setSelectedMemberToAdd("");
      fetchShift();
      onUpdated();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.message || json.error || "Failed to assign member");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this shift?")) return;

    const res = await fetch(`/api/shifts/${shiftId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Shift deleted");
      window.dispatchEvent(
        new CustomEvent("shiftaware:cache-invalidate", {
          detail: { keys: ["shifts", "shifts:*"] },
        }),
      );
      onClose();
      onUpdated();
    } else {
      if (res.status === 403) {
        toast.error("Shifts can't be deleted in the current event state");
      } else {
        toast.error("Failed to delete shift");
      }
    }
  };

  if (loading) {
    return (
      <Card className="p-4 animate-pulse">
        <div className="h-40 bg-gray-100 rounded" />
      </Card>
    );
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
        <h3 className="font-semibold text-sm">
          {shift.type.replace("_", " ")}
        </h3>
        <button
          onClick={onClose}
          className="ml-auto text-gray-400 hover:text-gray-600 text-xs"
        >
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
      <div>
        <div className="text-xs text-gray-600 mb-1">
          Assigned ({shift.assignments?.length || 0}/{shift.capacity})
        </div>
        {shift.assignments?.length > 0 && (
          <ul className="space-y-1">
            {shift.assignments.map((a: any) => (
              <li
                key={a.id}
                className="text-xs text-gray-700 flex items-center justify-between"
              >
                <span>
                  {a.teamMember?.alias || "Unknown"} ({a.role})
                </span>
                {canManualAssign && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAssignment(a.id)}
                    className="text-red-400 hover:text-red-600 text-xs"
                    title="Remove assignment"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canManualAssign &&
          (shift.assignments?.length || 0) < shift.capacity && (
            <div className="flex gap-1 mt-2">
              <select
                value={selectedMemberToAdd}
                onChange={(e) => setSelectedMemberToAdd(e.target.value)}
                className="flex-1 text-xs border rounded px-2 py-1"
              >
                <option value="">Add member...</option>
                {availableMembers.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.alias}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                onClick={handleAddAssignment}
                disabled={!selectedMemberToAdd}
                className="text-xs"
              >
                Add
              </Button>
            </div>
          )}
      </div>

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
