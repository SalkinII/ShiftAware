"use client";

import { useState, useEffect, useCallback } from "react";
import { HeatmapCell } from "./HeatmapCell";
import { RedistributeOverlay } from "./RedistributeOverlay";
import { deriveCellState, CellState } from "../hooks/useCellState";
import type { ShiftWithRelations, AssignmentState, Violation } from "@/lib/algorithm/types";
import { unwrapApiResponse } from "@/lib/api-errors";
import { CAN_ASSIGN_REASON_LABELS, CanAssignResult } from "@/lib/algorithm/can-assign";
import { seedCrossEventConflicts } from "@/lib/algorithm/cross-event-conflicts";

interface RedistributePreview {
  assignments: unknown[];
  violations: Violation[];
}

const HEATMAP_API = (eventId: string) =>
  `/api/events/${eventId}/distribution/heatmap`;

interface HeatmapData {
  shifts: ShiftWithRelations[];
  members: { id: string; alias: string; attributes?: Record<string, unknown> }[];
  assignments: { id: string; teamMemberId: string; shiftId: string }[];
  preferences: { teamMemberId: string; shiftId: string; wantLevel: string }[];
  config?: {
    balanceThresholds?: { maxShiftsPerPerson?: number; minRestHours?: number };
    minRestHours?: number;
  };
  allocationRules?: import("@/lib/algorithm/types").AllocationRule[];
  crossEventAssignments?: { memberId: string; shift: { id: string; eventId: string; startTime: string; endTime: string } }[];
  attributeDefinitions?: { id: string; name: string; type: string; options?: string[] }[];
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
  const [memberSearch, setMemberSearch] = useState<string>("");
  const [attributeKey, setAttributeKey] = useState<string>("all");
  const [attributeValue, setAttributeValue] = useState<string>("all");

  const refetch = useCallback(() => {
    fetch(HEATMAP_API(eventId))
      .then((r) => r.json())
      .then((json) => setData(unwrapApiResponse<HeatmapData>(json)));
  }, [eventId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const handleCellToggle = useCallback(
    async (
      memberId: string,
      shiftId: string,
      currentState: CellState,
      reason?: NonNullable<CanAssignResult["reason"]>,
    ) => {
      if (currentState === "blocked") {
        const label = reason
          ? CAN_ASSIGN_REASON_LABELS[reason]
          : "fails a hard constraint";
        if (!confirm(`This member ${label} for this shift. Assign anyway?`)) {
          return;
        }
      }

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
  const crossEventMemberShifts = new Map<string, string[]>();
  seedCrossEventConflicts(
    crossEventMemberShifts,
    allShiftsMap,
    (data.crossEventAssignments ?? []).map(({ memberId, shift }) => ({
      memberId,
      shift: {
        ...shift,
        preferences: [],
        assignments: [],
        requiredRoles: [],
        event: { id: shift.eventId, startDate: shift.startTime, endDate: shift.endTime },
      } as unknown as ShiftWithRelations,
    })),
  );
  const visibleShifts =
    shiftTypeFilter === "all"
      ? shifts
      : shifts.filter((s) => s.type === shiftTypeFilter);

  const shiftTypes = [...new Set(shifts.map((s) => s.type))];

  const attributeKeys = [
    ...new Set([
      ...members.flatMap((m) => Object.keys(m.attributes ?? {})),
      ...(data.attributeDefinitions ?? []).map((d) => d.name),
    ]),
  ];
  const attributeDefsByName = new Map(
    (data.attributeDefinitions ?? []).map((d) => [d.name, d]),
  );
  const selectedAttributeDef =
    attributeKey === "all" ? undefined : attributeDefsByName.get(attributeKey);
  const attributeValues =
    attributeKey === "all"
      ? []
      : selectedAttributeDef?.type === "BOOLEAN"
        ? ["true", "false"]
        : selectedAttributeDef?.type === "SELECT" ||
            selectedAttributeDef?.type === "MULTISELECT"
          ? (selectedAttributeDef.options ?? [])
          : [
              ...new Set(
                members
                  .map((m) => m.attributes?.[attributeKey])
                  .filter((v) => v !== undefined)
                  .map((v) => String(v)),
              ),
            ];

  const visibleMembers = members.filter((m) => {
    if (
      memberSearch.trim() &&
      !m.alias.toLowerCase().includes(memberSearch.trim().toLowerCase())
    ) {
      return false;
    }
    if (attributeKey !== "all" && attributeValue !== "all") {
      const rawValue = (m.attributes ?? {})[attributeKey];
      if (selectedAttributeDef?.type === "MULTISELECT") {
        if (!Array.isArray(rawValue) || !rawValue.includes(attributeValue)) {
          return false;
        }
      } else if (String(rawValue) !== attributeValue) {
        return false;
      }
    }
    return true;
  });

  const timeConstraintAttrNames = (data.attributeDefinitions ?? [])
    .filter((d) => d.type === "TIME_CONSTRAINT")
    .map((d) => d.name);

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
        <input
          type="text"
          placeholder="Search member..."
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          className="text-xs border rounded px-2 py-1 w-32"
        />
        <label className="sr-only" htmlFor="heatmap-attribute-key">
          Attribute
        </label>
        <select
          id="heatmap-attribute-key"
          aria-label="Attribute"
          value={attributeKey}
          onChange={(e) => {
            setAttributeKey(e.target.value);
            setAttributeValue("all");
          }}
          className="text-xs border rounded px-2 py-1"
        >
          <option value="all">All attributes</option>
          {attributeKeys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        {attributeKey !== "all" && (
          <>
            <label className="sr-only" htmlFor="heatmap-attribute-value">
              Attribute value
            </label>
            <select
              id="heatmap-attribute-value"
              aria-label="Attribute value"
              value={attributeValue}
              onChange={(e) => setAttributeValue(e.target.value)}
              className="text-xs border rounded px-2 py-1"
            >
              <option value="all">Any value</option>
              {attributeValues.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </>
        )}
        {selectedMembers.size > 0 && (
          <button
            onClick={handleRedistribute}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Redistribute {selectedMembers.size} selected
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="w-6" />
              <th className="w-24 text-left pr-2">Member</th>
              {visibleShifts.map((s) => {
                const start = new Date(s.startTime);
                const end = new Date(s.endTime);
                const weekday = start.toLocaleDateString("en-US", {
                  weekday: "short",
                });
                const dayMonth = `${start.getMonth() + 1}/${start.getDate()}`;
                const startTime = start.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const endTime = end.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <th
                    key={s.id}
                    className="w-14 text-center px-0.5 align-bottom"
                    title={`${s.type} · ${weekday} ${dayMonth} ${startTime}–${endTime}`}
                  >
                    <div className="flex flex-col leading-tight">
                      <span className="text-[9px] text-gray-500">
                        {weekday} {dayMonth}
                      </span>
                      <span className="text-[10px] font-medium">
                        {startTime}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleMembers.map((member) => {
              const memberShifts = (data.assignments ?? [])
                .filter((a) => a.teamMemberId === member.id)
                .map((a) => a.shiftId);

              const state: AssignmentState = {
                assignments: new Map(),
                memberShifts: new Map([[member.id, memberShifts]]),
                crossEventShifts: new Map([
                  [member.id, crossEventMemberShifts.get(member.id) ?? []],
                ]),
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
                    ) as Map<string, string>;
                    const { state: cellState, reason } = deriveCellState(
                      member.id,
                      shift,
                      isAssigned,
                      hasWant,
                      state,
                      canAssignConfig,
                      data.allocationRules ?? [],
                      allShiftsMap,
                      memberAttrs,
                      timeConstraintAttrNames,
                    );

                    return (
                      <td key={shift.id} className="px-0.5">
                        <HeatmapCell
                          state={cellState}
                          reason={reason}
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
