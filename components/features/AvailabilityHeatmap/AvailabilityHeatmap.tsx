"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { useCache } from "@/lib/cache/useCache";
import { format } from "date-fns";
import { Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvailabilityStatus {
  memberId: string;
  shiftId: string;
  status: "available" | "partial" | "unavailable" | "neutral";
  hasPreference: boolean;
  isAssigned: boolean;
  hasConflict: boolean;
  meetsRequirements: boolean;
  details?: {
    preferenceId?: string;
    assignmentId?: string;
    conflictShiftIds?: string[];
    missingRoles?: string[];
  };
}

interface TeamMember {
  id: string;
  alias: string;
  avatarId: string;
  experienceLevel: string;
  genderRole: string;
  capabilities: string[];
  isActive: boolean;
}

interface Shift {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  capacity: number;
  priority: string;
  requiredRoles?: { role: string; count: number }[];
}

interface HeatmapData {
  members: TeamMember[];
  shifts: Shift[];
  availability: AvailabilityStatus[][];
  summary: {
    totalMembers: number;
    totalShifts: number;
    availableCount: number;
    partialCount: number;
    unavailableCount: number;
    neutralCount: number;
  };
}

interface AvailabilityHeatmapProps {
  memberIds?: string[];
  shiftIds?: string[];
  startDate?: Date;
  endDate?: Date;
  shiftType?: string;
  onCellClick?: (
    memberId: string,
    shiftId: string,
    status: AvailabilityStatus,
  ) => void;
}

export function AvailabilityHeatmap({
  memberIds,
  shiftIds,
  startDate,
  endDate,
  shiftType,
  onCellClick,
}: AvailabilityHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    memberId: string;
    shiftId: string;
  } | null>(null);

  // Build query string
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (memberIds && memberIds.length > 0) {
      params.set("memberIds", memberIds.join(","));
    }
    if (shiftIds && shiftIds.length > 0) {
      params.set("shiftIds", shiftIds.join(","));
    }
    if (startDate) {
      params.set("startDate", startDate.toISOString());
    }
    if (endDate) {
      params.set("endDate", endDate.toISOString());
    }
    if (shiftType) {
      params.set("shiftType", shiftType);
    }
    return params.toString();
  }, [memberIds, shiftIds, startDate, endDate, shiftType]);

  const {
    data: heatmapData,
    loading,
    error,
    refetch,
  } = useCache<HeatmapData>({
    key: `availability-${queryParams}`,
    fetchFn: async () => {
      const url = `/api/members/availability${queryParams ? `?${queryParams}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            errorData.error ||
            "Failed to fetch availability",
        );
      }
      return res.json();
    },
  });

  const getStatusColor = (status: AvailabilityStatus["status"]) => {
    switch (status) {
      case "available":
        return "bg-green-100 border-green-300 hover:bg-green-200";
      case "partial":
        return "bg-yellow-100 border-yellow-300 hover:bg-yellow-200";
      case "unavailable":
        return "bg-red-100 border-red-300 hover:bg-red-200";
      case "neutral":
        return "bg-gray-50 border-gray-200 hover:bg-gray-100";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const getStatusLabel = (status: AvailabilityStatus["status"]) => {
    switch (status) {
      case "available":
        return "Available";
      case "partial":
        return "Partial";
      case "unavailable":
        return "Unavailable";
      case "neutral":
        return "Neutral";
      default:
        return "Unknown";
    }
  };

  const getTooltipContent = (
    member: TeamMember,
    shift: Shift,
    status: AvailabilityStatus,
  ) => {
    const lines: string[] = [];
    lines.push(`${member.alias} - ${shift.type}`);
    lines.push(`Status: ${getStatusLabel(status.status)}`);
    if (status.hasPreference) {
      lines.push("✓ Has preference");
    }
    if (status.isAssigned) {
      lines.push("✓ Assigned to this shift");
    }
    if (status.hasConflict) {
      lines.push(
        `⚠ Has ${status.details?.conflictShiftIds?.length || 0} conflicting assignment(s)`,
      );
    }
    if (!status.meetsRequirements && status.details?.missingRoles) {
      lines.push(`⚠ Missing roles: ${status.details.missingRoles.join(", ")}`);
    }
    return lines.join("\n");
  };

  if (loading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          <span className="ml-3 text-gray-600">
            Loading availability data...
          </span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8">
        <div className="text-center text-red-600">
          <p className="font-semibold">Error loading availability</p>
          <p className="text-sm mt-1">{error.message}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            Retry
          </button>
        </div>
      </Card>
    );
  }

  if (
    !heatmapData ||
    heatmapData.members.length === 0 ||
    heatmapData.shifts.length === 0
  ) {
    return (
      <Card className="p-8">
        <div className="text-center text-gray-500">
          <p>No availability data available</p>
        </div>
      </Card>
    );
  }

  const { members, shifts, availability, summary } = heatmapData;

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Member Availability Heatmap
          </h2>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              Members
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {summary.totalMembers}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              Shifts
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {summary.totalShifts}
            </p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-xs text-green-700 uppercase tracking-wider">
              Available
            </p>
            <p className="text-2xl font-bold text-green-900">
              {summary.availableCount}
            </p>
          </div>
          <div className="p-3 bg-yellow-50 rounded-lg">
            <p className="text-xs text-yellow-700 uppercase tracking-wider">
              Partial
            </p>
            <p className="text-2xl font-bold text-yellow-900">
              {summary.partialCount}
            </p>
          </div>
          <div className="p-3 bg-red-50 rounded-lg">
            <p className="text-xs text-red-700 uppercase tracking-wider">
              Unavailable
            </p>
            <p className="text-2xl font-bold text-red-900">
              {summary.unavailableCount}
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-sm">
          <span className="font-semibold text-gray-700">Legend:</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded" />
            <span>Partial</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 border border-red-300 rounded" />
            <span>Unavailable</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded" />
            <span>Neutral</span>
          </div>
        </div>
      </div>

      {/* Heatmap Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-white p-3 text-left border-b border-r border-gray-200 font-semibold text-sm text-gray-700">
                Member
              </th>
              {shifts.map((shift) => (
                <th
                  key={shift.id}
                  className="p-2 border-b border-r border-gray-200 text-center font-semibold text-xs text-gray-700 min-w-[100px]"
                  title={`${format(new Date(shift.startTime), "MMM d, HH:mm")} - ${format(new Date(shift.endTime), "HH:mm")}`}
                >
                  <div className="flex flex-col">
                    <span className="font-bold">{shift.type}</span>
                    <span className="text-gray-500 text-[10px] mt-1">
                      {format(new Date(shift.startTime), "MMM d")}
                    </span>
                    <span className="text-gray-500 text-[10px]">
                      {format(new Date(shift.startTime), "HH:mm")}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((member, memberIndex) => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="sticky left-0 z-10 bg-white p-3 border-b border-r border-gray-200 font-medium text-sm text-gray-900">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{member.avatarId}</span>
                    <span>{member.alias}</span>
                  </div>
                </td>
                {shifts.map((shift, shiftIndex) => {
                  const status = availability[memberIndex]?.[shiftIndex];
                  if (!status) return null;

                  const isHovered =
                    hoveredCell?.memberId === member.id &&
                    hoveredCell?.shiftId === shift.id;

                  return (
                    <td
                      key={`${member.id}-${shift.id}`}
                      className="p-1 border-b border-r border-gray-200 text-center"
                    >
                      <div
                        className={cn(
                          "w-10 h-10 mx-auto rounded-lg border-2 cursor-pointer transition-all",
                          getStatusColor(status.status),
                          isHovered && "ring-2 ring-primary-500 ring-offset-1",
                        )}
                        onMouseEnter={() =>
                          setHoveredCell({
                            memberId: member.id,
                            shiftId: shift.id,
                          })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={() =>
                          onCellClick?.(member.id, shift.id, status)
                        }
                        title={getTooltipContent(member, shift, status)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onCellClick?.(member.id, shift.id, status);
                          }
                        }}
                        aria-label={`${member.alias} - ${shift.type}: ${getStatusLabel(status.status)}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip */}
      {hoveredCell &&
        (() => {
          const member = members.find((m) => m.id === hoveredCell.memberId);
          const shift = shifts.find((s) => s.id === hoveredCell.shiftId);
          const memberIndex = members.findIndex(
            (m) => m.id === hoveredCell.memberId,
          );
          const shiftIndex = shifts.findIndex(
            (s) => s.id === hoveredCell.shiftId,
          );
          const status = availability[memberIndex]?.[shiftIndex];

          if (!member || !shift || !status) return null;

          return (
            <div
              className="fixed z-50 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg pointer-events-none"
              style={{
                left: `${typeof window !== "undefined" ? window.innerWidth / 2 : 0}px`,
                top: `${typeof window !== "undefined" ? window.innerHeight / 2 : 0}px`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="whitespace-pre-line">
                {getTooltipContent(member, shift, status)}
              </div>
            </div>
          );
        })()}
    </Card>
  );
}
