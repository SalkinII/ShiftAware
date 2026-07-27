"use client";

import { useState, useEffect, useCallback } from "react";
import { HeatmapCell } from "./HeatmapCell";
import { RedistributeOverlay } from "./RedistributeOverlay";
import { deriveCellState, CellState } from "../hooks/useCellState";
import type { ShiftWithRelations, AssignmentState, Violation } from "@/lib/algorithm/types";
import { unwrapApiResponse } from "@/lib/api-errors";

interface RedistributePreview {
  assignments: unknown[];
  violations: Violation[];
}

const HEATMAP_API = (eventId: string) =>
  `/api/events/${eventId}/distribution/heatmap`;

interface HeatmapData {
  shifts: ShiftWithRelations[];
  members: { id: string; alias: string; attributes?: Record<string, string> }[];
  assignments: { id: string; teamMemberId: string; shiftId: string }[];
  preferences: { teamMemberId: string; shiftId: string; wantLevel: string }[];
  config?: {
    balanceThresholds?: { maxShiftsPerPerson?: number; minRestHours?: number };
    minRestHours?: number;
  };
  allocationRules?: import("@/lib/algorithm/types").AllocationRule[];
}

interface Props {
  eventId: string;
  previewData: unknown;
  highlightMemberId: string | null;
  onMemberSelect: (id: string | null) => void;
}

export function DistributionHeatmap({
  eventId,
  previewData: _previewData,
  highlightMemberId,
  onMemberSelect,
}: Props) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [redistributePreview, setRedistributePreview] =
    useState<RedistributePreview | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [shiftTypeFilter, setShiftTypeFilter] = useState<string>("all");

  const refetch = useCallback(() => {
    fetch(HEATMAP_API(eventId))
      .then((r) => r.json())
      .then((json) => setData(unwrapApiResponse<HeatmapData>(json)));
  }, [eventId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const handleCellToggle = useCallback(
    async (memberId: string, shiftId: string, currentState: CellState) => {
      if (currentState === "blocked") return;

      if (currentState === "assigned" || currentState === "conflict") {
        if (!confirm("Remove this assignment?")) return;
        const assignment = data?.assignments.find(
          (a) => a.teamMemberId === memberId && a.shiftId === shiftId,
        );
        if (!assignment) return;
        await fetch(`/api/assignments?id=${assignment.id}`, {
          method: "DELETE",
        });
      } else {
        await fetch("/api/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            assignments: [
              {
                shiftId,
                teamMemberId: memberId,
                role: "TEAM_MEMBER",
                assignmentType: "MANUAL",
              },
            ],
          }),
        });
      }

      refetch();
    },
    [eventId, data?.assignments, refetch],
  );

  const toggleMemberSelection = useCallback(
    (memberId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedMembers((prev) => {
        const next = new Set(prev);
        if (next.has(memberId)) next.delete(memberId);
        else next.add(memberId);
        return next;
      });
    },
    [],
  );

  const handleRedistribute = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/assignments/redistribute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: { memberIds: [...selectedMembers] },
        dryRun: true,
      }),
    });
    const json = await res.json();
    setRedistributePreview(unwrapApiResponse<RedistributePreview>(json));
  }, [eventId, selectedMembers]);

  const handleConfirmRedistribute = useCallback(async () => {
    setIsCommitting(true);
    try {
      await fetch(`/api/events/${eventId}/assignments/redistribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: { memberIds: [...selectedMembers] },
          dryRun: false,
        }),
      });
      setRedistributePreview(null);
      setSelectedMembers(new Set());
      window.location.reload();
    } finally {
      setIsCommitting(false);
    }
  }, [eventId, selectedMembers]);

  if (!data) return <div className="text-sm text-gray-400">Loading heatmap...</div>;

  const shifts = data.shifts ?? [];
  const members = data.members ?? [];
  const allShiftsMap = new Map(shifts.map((s) => [s.id, s]));
  const visibleShifts =
    shiftTypeFilter === "all"
      ? shifts
      : shifts.filter((s) => s.type === shiftTypeFilter);

  const shiftTypes = [...new Set(shifts.map((s) => s.type))];

  const canAssignConfig = {
    maxShiftsPerPerson:
      data.config?.balanceThresholds?.maxShiftsPerPerson ?? Infinity,
    minRestMs:
      (data.config?.balanceThresholds?.minRestHours ??
        data.config?.minRestHours ??
        8) * 3600000,
  };

  return (
    <div className="overflow-auto border rounded p-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium">Heatmap</span>
        <select
          value={shiftTypeFilter}
          onChange={(e) => setShiftTypeFilter(e.target.value)}
          className="text-xs border rounded px-2 py-1"
        >
          <option value="all">All types</option>
          {shiftTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {selectedMembers.size > 0 && (
          <button
            onClick={handleRedistribute}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Redistribute {selectedMembers.size} selected
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">
          ✗ blocked · eligible ★ preferred ■ assigned ▲ conflict
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="w-6" />
              <th className="w-24 text-left pr-2">Member</th>
              {visibleShifts.map((s) => (
                <th
                  key={s.id}
                  className="w-8 text-center px-0.5"
                  title={String(s.startTime)}
                >
                  {new Date(s.startTime).getDate()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const memberShifts = (data.assignments ?? [])
                .filter((a) => a.teamMemberId === member.id)
                .map((a) => a.shiftId);

              const state: AssignmentState = {
                assignments: new Map(),
                memberShifts: new Map([[member.id, memberShifts]]),
                shiftCoverage: new Map(
                  shifts.map((s) => [
                    s.id,
                    (data.assignments ?? []).filter((a) => a.shiftId === s.id)
                      .length,
                  ]),
                ),
                reservedSlots: new Map(),
              };

              return (
                <tr
                  key={member.id}
                  className={highlightMemberId === member.id ? "bg-yellow-50" : ""}
                  onClick={() =>
                    onMemberSelect(
                      member.id === highlightMemberId ? null : member.id,
                    )
                  }
                >
                  <td className="px-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedMembers.has(member.id)}
                      onChange={() => {}}
                      onClick={(e) => toggleMemberSelection(member.id, e)}
                      aria-label={`Select ${member.alias}`}
                    />
                  </td>
                  <td className="pr-2 font-medium cursor-pointer">{member.alias}</td>
                  {visibleShifts.map((shift) => {
                    const isAssigned = memberShifts.includes(shift.id);
                    const hasWant = (data.preferences ?? []).some(
                      (p) =>
                        p.teamMemberId === member.id &&
                        p.shiftId === shift.id &&
                        p.wantLevel === "WANT",
                    );
                    const memberAttrs = new Map(
                      Object.entries(member.attributes ?? {}),
                    );
                    const cellState = deriveCellState(
                      member.id,
                      shift,
                      isAssigned,
                      hasWant,
                      state,
                      canAssignConfig,
                      data.allocationRules ?? [],
                      allShiftsMap,
                      memberAttrs,
                    );

                    return (
                      <td key={shift.id} className="px-0.5">
                        <HeatmapCell
                          state={cellState}
                          memberId={member.id}
                          shiftId={shift.id}
                          selected={selectedCells.has(`${member.id}:${shift.id}`)}
                          onToggle={handleCellToggle}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {redistributePreview !== null && (
        <RedistributeOverlay
          dryRunResult={redistributePreview}
          onConfirm={handleConfirmRedistribute}
          onCancel={() => setRedistributePreview(null)}
          isCommitting={isCommitting}
        />
      )}
    </div>
  );
}
