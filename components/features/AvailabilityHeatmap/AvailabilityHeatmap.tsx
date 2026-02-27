"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { useCache } from "@/lib/cache/useCache";
import { unwrapApiResponse } from "@/lib/api-errors";
import { format } from "date-fns";
import { Loader2, UserPlus, Check, X, Minus } from "lucide-react";
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
      const data = await res.json();
      return unwrapApiResponse<HeatmapData>(data);
    },
  });

  const getStatusColor = (
    status: AvailabilityStatus["status"],
    isAssigned: boolean,
  ) => {
    if (isAssigned) {
      return "bg-primary-100 border-primary-400 hover:bg-primary-200";
    }
    switch (status) {
      case "available":
        return "bg-green-100 border-green-400 hover:bg-green-200 hover:border-green-500";
      case "partial":
        return "bg-amber-100 border-amber-400 hover:bg-amber-200 hover:border-amber-500";
      case "unavailable":
        return "bg-red-100 border-red-400 hover:bg-red-200 hover:border-red-500";
      case "neutral":
        return "bg-gray-100 border-gray-300 hover:bg-gray-200";
      default:
        return "bg-gray-100 border-gray-300";
    }
  };

  const getStatusIcon = (
    status: AvailabilityStatus["status"],
    isAssigned: boolean,
  ) => {
    if (isAssigned) {
      return <Check className="w-2.5 h-2.5 text-primary-600" />;
    }
    switch (status) {
      case "available":
        return <UserPlus className="w-2.5 h-2.5 text-green-600" />;
      case "partial":
        return <Minus className="w-2.5 h-2.5 text-amber-600" />;
      case "unavailable":
        return <X className="w-2.5 h-2.5 text-red-600" />;
      case "neutral":
        return null;
      default:
        return null;
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

    // Header with member and shift info
    lines.push(`${member.alias} (${member.experienceLevel})`);
    lines.push(
      `${shift.type.replace("_", " ")} • ${format(new Date(shift.startTime), "MMM d, HH:mm")}`,
    );
    lines.push("─".repeat(20));

    // Status with explanation
    if (status.isAssigned) {
      lines.push("-check- ASSIGNED to this shift");
    } else {
      switch (status.status) {
        case "available":
          lines.push("-check- AVAILABLE - Can be assigned");
          if (status.hasPreference) {
            lines.push("   • Member requested this shift");
          }
          break;
        case "partial":
          lines.push("⚠ PARTIAL - Has constraints:");
          if (status.hasConflict) {
            lines.push(
              `   • Conflict with ${status.details?.conflictShiftIds?.length || 0} shift(s)`,
            );
          }
          if (!status.meetsRequirements && status.details?.missingRoles) {
            lines.push(
              `   • Missing: ${status.details.missingRoles.join(", ")}`,
            );
          }
          if (!status.hasPreference) {
            lines.push("   • No preference submitted");
          }
          break;
        case "unavailable":
          lines.push("x UNAVAILABLE:");
          if (status.hasConflict) {
            lines.push(`   • Scheduled conflict`);
          }
          if (!status.meetsRequirements && status.details?.missingRoles) {
            lines.push(`   • Missing required role(s)`);
          }
          break;
        case "neutral":
          lines.push("○ NEUTRAL - No preference data");
          break;
      }
    }

    // Capacity info
    const assignedCount = shift.capacity; // This would ideally show current vs max
    lines.push("─".repeat(20));
    lines.push(`Shift capacity: ${shift.capacity}`);

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
    <Card className="p-4">
      {/* Header - Condensed */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">
            Availability Matrix
          </h2>
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Summary Stats - Condensed inline */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-lg">
            <span className="text-xs text-gray-500">Members:</span>
            <span className="text-sm font-bold text-gray-900">
              {summary.totalMembers}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-lg">
            <span className="text-xs text-gray-500">Shifts:</span>
            <span className="text-sm font-bold text-gray-900">
              {summary.totalShifts}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 rounded-lg">
            <UserPlus className="w-3 h-3 text-green-600" />
            <span className="text-sm font-bold text-green-700">
              {summary.availableCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded-lg">
            <Minus className="w-3 h-3 text-amber-600" />
            <span className="text-sm font-bold text-amber-700">
              {summary.partialCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 rounded-lg">
            <X className="w-3 h-3 text-red-600" />
            <span className="text-sm font-bold text-red-700">
              {summary.unavailableCount}
            </span>
          </div>
        </div>

        {/* Legend - Compact */}
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span className="font-semibold">Click to assign:</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-100 border border-green-400 rounded flex items-center justify-center">
              <UserPlus className="w-2 h-2 text-green-600" />
            </div>
            <span>Can assign</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-amber-100 border border-amber-400 rounded flex items-center justify-center">
              <Minus className="w-2 h-2 text-amber-600" />
            </div>
            <span>Warning</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-100 border border-red-400 rounded flex items-center justify-center">
              <X className="w-2 h-2 text-red-600" />
            </div>
            <span>Blocked</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-primary-100 border border-primary-400 rounded flex items-center justify-center">
              <Check className="w-2 h-2 text-primary-600" />
            </div>
            <span>Assigned</span>
          </div>
        </div>
      </div>

      {/* Heatmap Table - Condensed */}
      <div className="overflow-x-auto max-h-[60vh]">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-20 bg-white">
            <tr>
              <th className="sticky left-0 z-30 bg-gray-50 p-1.5 text-left border-b border-r border-gray-200 font-bold text-[9px] uppercase tracking-wider text-gray-500 min-w-[100px]">
                Member
              </th>
              {shifts.map((shift) => (
                <th
                  key={shift.id}
                  className="p-1 border-b border-r border-gray-200 text-center font-semibold min-w-[50px] bg-gray-50"
                  title={`${format(new Date(shift.startTime), "MMM d, HH:mm")} - ${format(new Date(shift.endTime), "HH:mm")}`}
                >
                  <div className="flex flex-col leading-none">
                    <span className="text-[8px] font-bold text-gray-600 truncate">
                      {shift.type.replace("_", " ").slice(0, 8)}
                    </span>
                    <span className="text-[8px] text-gray-400">
                      {format(new Date(shift.startTime), "d/M")}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((member, memberIndex) => (
              <tr key={member.id} className="hover:bg-gray-50/50">
                <td className="sticky left-0 z-10 bg-white p-1 border-b border-r border-gray-200 font-medium text-gray-900 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-sm">{member.avatarId}</span>
                    <span className="truncate max-w-[60px]">
                      {member.alias}
                    </span>
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
                      className="p-0 border-b border-r border-gray-100 text-center"
                    >
                      <div
                        className={cn(
                          "w-5 h-5 mx-auto rounded border cursor-pointer transition-all flex items-center justify-center",
                          getStatusColor(status.status, status.isAssigned),
                          isHovered &&
                            "ring-2 ring-primary-500 ring-offset-1 scale-125",
                          status.status === "available" &&
                            !status.isAssigned &&
                            "hover:scale-125",
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
                      >
                        {getStatusIcon(status.status, status.isAssigned)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Help text */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 text-center">
          Click a green cell to assign member to shift • Hover for details
        </p>
      </div>
    </Card>
  );
}
