"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { X } from "lucide-react";
import { getShiftDisplayInfo } from "@/lib/utils/shift-display";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ColorStripe } from "@/components/ui/ColorStripe";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { canManuallyAssign } from "@/lib/services/event-status-permissions";
import type { EventStatus } from "@prisma/client";
import { ProfileDetailCard } from "@/components/features/Identity/ProfileDetailCard";

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
  const [desirabilityScore, setDesirabilityScore] = useState(3);
  const [availableMembers, setAvailableMembers] = useState<any[]>([]);
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState("");
  const [profileCardMember, setProfileCardMember] = useState<{
    alias: string;
    avatarId?: string;
  } | null>(null);

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
      setDesirabilityScore(data.desirabilityScore ?? 3);
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
        desirabilityScore,
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
      <GlassPanel className="w-80 border-l border-gray-200 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </div>
      </GlassPanel>
    );
  }

  if (!shift) {
    return (
      <GlassPanel className="w-80 border-l border-gray-200 p-4 text-gray-500">
        Shift not found
      </GlassPanel>
    );
  }

  const laneColor = shift?.template?.color || "#6b7280";
  const wantCount =
    shift?.preferences?.filter((p: any) => p.wantLevel === "WANT").length || 0;
  const dontWantCount =
    shift?.preferences?.filter((p: any) => p.wantLevel === "DONT_WANT")
      .length || 0;

  return (
    <GlassPanel className="w-80 border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 truncate">
          {shift?.template?.name || "Shift Details"}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Shift Info Card */}
        <div className="bg-sky-50 rounded-lg p-3 border border-sky-100">
          <div className="flex items-center gap-2 mb-2">
            <ColorStripe color={laneColor} className="h-4" />
           {(() => {
            const info = getShiftDisplayInfo(shift);
            return (
              <>
                <div className="text-sm text-gray-600">{info.date}</div>
                <div className="text-sm text-gray-600">{info.timeRange}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {info.assignedCount}/{info.capacity} assigned
                </div>
              </>
            );
          })()}
          </div>
        </div>

        {/* Time & Capacity inputs */}
        <div className="space-y-2">
          <SectionLabel className="mb-2">Edit Times</SectionLabel>
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
              min={0}
              value={capacity}
              onChange={(e) => setCapacity(Math.max(0, parseInt(e.target.value) || 0))}
              className="mt-1 block w-full border rounded px-2 py-1 text-sm"
            />
          </label>
        </div>
        <div className="h-1 bg-gray-200 my-2"></div>

        {/* Desirability Score */}
        <div>
          <SectionLabel className="mb-2">Desirability Score</SectionLabel>
          <div className="flex gap-2 mt-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setDesirabilityScore(n)}
                className={cn(
                  "text-2xl font-bold leading-none transition-colors",
                  n <= desirabilityScore
                    ? desirabilityScore >= 4
                      ? "text-amber-500"
                      : desirabilityScore <= 2
                        ? "text-blue-400"
                        : "text-gray-400"
                    : "text-gray-200",
                )}
              >
                +
              </button>
            ))}
          </div>
          <div className="h-1 bg-gray-200 my-2"></div>
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>{wantCount} people want this shift</span>
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>{dontWantCount} people don't want this shift</span>
          </div>
        </div>
        <div className="h-1 bg-gray-200 my-2"></div>

        {/* Assignments */}
        <div>
          {/* <div className="flex items-center justify-between mb-2">
            <SectionLabel>Assigned</SectionLabel>
            <span className="text-xs text-gray-400">
              {shift?.assignments?.length || 0}/{shift?.capacity}
            </span>
          </div> */}

          <div className="space-y-2">
            {shift?.assignments?.map((assignment: any) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg group"
              >
                <button
                  className="flex items-center gap-2 text-left hover:bg-sky-50 rounded-lg px-1 -mx-1 transition-colors"
                  onClick={() =>
                    setProfileCardMember({
                      alias: assignment.teamMember?.alias || "Unknown",
                      avatarId: assignment.teamMember?.avatarId,
                    })
                  }
                  title={`View ${assignment.teamMember?.alias}'s profile`}
                >
                  <AvatarStack
                    members={[
                      {
                        alias: assignment.teamMember?.alias || "?",
                        avatarId: assignment.teamMember?.avatarId,
                      },
                    ]}
                    max={1}
                    size="md"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {assignment.teamMember?.alias || "Unknown"}
                    </div>
                    <div className="text-xs text-gray-500">{assignment.role}</div>
                  </div>
                </button>
                {canManualAssign && (
                  <button
                    onClick={() => handleRemoveAssignment(assignment.id)}
                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add Member Button */}
          {canManualAssign &&
            availableMembers.length > 0 &&
            (shift?.assignments?.length || 0) < (shift?.capacity || 0) && (
            <div className="mt-2">
              <select
                value={selectedMemberToAdd}
                onChange={(e) => setSelectedMemberToAdd(e.target.value)}
                className="w-full p-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 transition-colors"
              >
                <option value="">+ Add Member</option>
                {availableMembers.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.alias}
                  </option>
                ))}
              </select>
              {selectedMemberToAdd && (
                <Button
                  size="sm"
                  className="w-full mt-2"
                  onClick={handleAddAssignment}
                >
                  Add {availableMembers.find((m: any) => m.id === selectedMemberToAdd)?.alias}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        <Button
          variant="ghost"
          className="w-full text-red-600 hover:bg-red-50"
          onClick={handleDelete}
        >
          Delete Shift
        </Button>
      </div>

      <ProfileDetailCard
        member={profileCardMember}
        onClose={() => setProfileCardMember(null)}
      />
    </GlassPanel>
  );
}
