import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma, ShiftType, Role } from "@prisma/client";

// Type definitions for Prisma includes
type MemberWithRelations = Prisma.TeamMemberGetPayload<{
  include: {
    preferences: { include: { shift: true } };
    assignments: { include: { shift: true } };
  };
}>;

type ShiftWithRelations = Prisma.ShiftGetPayload<{
  include: {
    requiredRoles: true;
    assignments: { include: { teamMember: true } };
    preferences: { include: { teamMember: true } };
  };
}>;

type ShiftRole = {
  role: string;
  count: number;
};

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

interface MemberSummary {
  id: string;
  alias: string;
  avatarId: string;
  experienceLevel: string;
  capabilities: string[];
  isActive: boolean;
}

interface ShiftSummary {
  id: string;
  type: string;
  templateName: string;
  startTime: Date;
  endTime: Date;
  capacity: number;
  priority: string;
  requiredRoles?: ShiftRole[];
}

interface HeatmapData {
  members: MemberSummary[];
  shifts: ShiftSummary[];
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

function checkShiftOverlap(
  shift1Start: Date,
  shift1End: Date,
  shift2Start: Date,
  shift2End: Date,
): boolean {
  return (
    (shift1Start >= shift2Start && shift1Start < shift2End) ||
    (shift1End > shift2Start && shift1End <= shift2End) ||
    (shift1Start <= shift2Start && shift1End >= shift2End)
  );
}

function checkMemberMeetsRequirements(
  member: MemberWithRelations,
  shift: ShiftWithRelations,
): { meets: boolean; missingRoles: string[] } {
  if (!shift.requiredRoles || shift.requiredRoles.length === 0) {
    return { meets: true, missingRoles: [] };
  }

  const memberRoles = member.capabilities || [];
  const requiredRoles = shift.requiredRoles.map((r) => r.role);
  const missingRoles = requiredRoles.filter(
    (role: Role) => !memberRoles.includes(role),
  );

  return {
    meets: missingRoles.length === 0,
    missingRoles,
  };
}

function calculateAvailabilityStatus(
  member: MemberWithRelations,
  shift: ShiftWithRelations,
  memberPreferences: Map<string, string[]>, // memberId -> shiftIds[]
  memberAssignments: Map<
    string,
    Prisma.AssignmentGetPayload<{ include: { shift: true } }>[]
  >, // memberId -> assignments[]
  allShifts: ShiftWithRelations[],
): AvailabilityStatus {
  const memberId = member.id;
  const shiftId = shift.id;

  // Check preference
  const preferredShiftIds = memberPreferences.get(memberId) || [];
  const hasPreference = preferredShiftIds.includes(shiftId);

  // Check assignment
  const assignments = memberAssignments.get(memberId) || [];
  const isAssigned = assignments.some(
    (a: { shiftId: string }) => a.shiftId === shiftId,
  );
  const assignment = assignments.find(
    (a: { shiftId: string }) => a.shiftId === shiftId,
  );

  // Check conflicts (overlapping shifts)
  const shiftStart = new Date(shift.startTime);
  const shiftEnd = new Date(shift.endTime);
  const conflictingAssignments = assignments.filter((a) => {
    if (a.shiftId === shiftId) return false; // Don't count self
    const assignedShift = allShifts.find((s) => s.id === a.shiftId);
    if (!assignedShift) return false;
    return checkShiftOverlap(
      shiftStart,
      shiftEnd,
      new Date(assignedShift.startTime),
      new Date(assignedShift.endTime),
    );
  });
  const hasConflict = conflictingAssignments.length > 0;

  // Check requirements
  const { meets: meetsRequirements, missingRoles } =
    checkMemberMeetsRequirements(member, shift);

  // Determine status
  let status: "available" | "partial" | "unavailable" | "neutral";

  if (isAssigned) {
    status = "unavailable"; // Assigned to this shift
  } else if (hasConflict) {
    status = "unavailable"; // Has conflicting assignment
  } else if (hasPreference && meetsRequirements) {
    status = "available"; // Has preference, available, meets requirements
  } else if (hasPreference || meetsRequirements) {
    status = "partial"; // Has preference but doesn't meet requirements, or meets requirements but no preference
  } else {
    status = "neutral"; // No preference, no assignment, no conflict, doesn't meet requirements
  }

  return {
    memberId,
    shiftId,
    status,
    hasPreference,
    isAssigned,
    hasConflict,
    meetsRequirements,
    details: {
      preferenceId: hasPreference
        ? member.preferences?.find((p) => p.shiftId === shiftId)?.id
        : undefined,
      assignmentId: assignment?.id,
      conflictShiftIds: conflictingAssignments.map((a) => a.shiftId),
      missingRoles: missingRoles.length > 0 ? missingRoles : undefined,
    },
  };
}

export const GET = withAuth(withErrorHandling(async (request: NextRequest) => {
  // Check authentication

  // Parse query parameters
  const searchParams = request.nextUrl.searchParams;
  const memberIdsParam = searchParams.get("memberIds");
  const shiftIdsParam = searchParams.get("shiftIds");
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const shiftTypeParam = searchParams.get("shiftType");
  const eventIdParam = searchParams.get("eventId") || undefined;

  const memberIds = memberIdsParam
    ? memberIdsParam.split(",").filter(Boolean)
    : undefined;
  const shiftIds = shiftIdsParam
    ? shiftIdsParam.split(",").filter(Boolean)
    : undefined;
  const startDate = startDateParam ? new Date(startDateParam) : undefined;
  const endDate = endDateParam ? new Date(endDateParam) : undefined;

  // Fetch members
  const membersWhere: Prisma.TeamMemberWhereInput = { isActive: true };
  if (memberIds && memberIds.length > 0) {
    membersWhere.id = { in: memberIds };
  }

  const members = await prisma.teamMember.findMany({
    where: membersWhere,
    include: {
      preferences: {
        include: {
          shift: true,
        },
      },
      assignments: {
        include: {
          shift: true,
        },
      },
    },
    orderBy: {
      alias: "asc",
    },
  });

  // Fetch shifts
  const shiftsWhere: Prisma.ShiftWhereInput = {};
  if (shiftIds && shiftIds.length > 0) {
    shiftsWhere.id = { in: shiftIds };
  }
  if (startDate) {
    shiftsWhere.startTime = { gte: startDate };
  }
  if (endDate) {
    shiftsWhere.endTime = { lte: endDate };
  }
  if (shiftTypeParam) {
    shiftsWhere.type = shiftTypeParam as ShiftType;
  }
  if (eventIdParam) {
    shiftsWhere.eventId = eventIdParam;
  }

  const shifts = await prisma.shift.findMany({
    where: shiftsWhere,
    include: {
      requiredRoles: true,
      template: { select: { id: true, name: true } },
      assignments: {
        include: {
          teamMember: true,
        },
      },
      preferences: {
        include: {
          teamMember: true,
        },
      },
    },
    orderBy: {
      startTime: "asc",
    },
  });

  // Build maps for efficient lookup
  const memberPreferences = new Map<string, string[]>();
  const memberAssignments = new Map<
    string,
    Prisma.AssignmentGetPayload<{ include: { shift: true } }>[]
  >();

  members.forEach((member) => {
    const preferredShiftIds = member.preferences?.map((p) => p.shiftId) || [];
    memberPreferences.set(member.id, preferredShiftIds);

    const assignments = member.assignments || [];
    memberAssignments.set(member.id, assignments);
  });

  // Calculate availability matrix
  const availability: AvailabilityStatus[][] = members.map((member) =>
    shifts.map((shift) =>
      calculateAvailabilityStatus(
        member,
        shift,
        memberPreferences,
        memberAssignments,
        shifts,
      ),
    ),
  );

  // Calculate summary
  let availableCount = 0;
  let partialCount = 0;
  let unavailableCount = 0;
  let neutralCount = 0;

  availability.forEach((row) => {
    row.forEach((cell) => {
      switch (cell.status) {
        case "available":
          availableCount++;
          break;
        case "partial":
          partialCount++;
          break;
        case "unavailable":
          unavailableCount++;
          break;
        case "neutral":
          neutralCount++;
          break;
      }
    });
  });

  const response: HeatmapData = {
    members: members.map((m) => ({
      id: m.id,
      alias: m.alias,
      avatarId: m.avatarId,
      experienceLevel: m.experienceLevel,
      capabilities: m.capabilities,
      isActive: m.isActive,
    })),
    shifts: shifts.map((s) => ({
      id: s.id,
      type: s.type,
      templateName: s.template?.name ?? s.type.replace(/_/g, " "),
      startTime: s.startTime,
      endTime: s.endTime,
      capacity: s.capacity,
      priority: s.priority,
      requiredRoles: s.requiredRoles?.map((r) => ({
        role: r.role,
        count: r.count,
      })),
    })),
    availability,
    summary: {
      totalMembers: members.length,
      totalShifts: shifts.length,
      availableCount,
      partialCount,
      unavailableCount,
      neutralCount,
    },
  };

  return NextResponse.json(response);
}));
