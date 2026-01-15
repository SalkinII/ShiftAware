import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { createUnauthorizedResponse } from "@/lib/api-errors";

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

interface HeatmapData {
  members: any[];
  shifts: any[];
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
  member: any,
  shift: any,
): { meets: boolean; missingRoles: string[] } {
  if (!shift.requiredRoles || shift.requiredRoles.length === 0) {
    return { meets: true, missingRoles: [] };
  }

  const memberRoles = member.capabilities || [];
  const requiredRoles = shift.requiredRoles.map((r: any) => r.role);
  const missingRoles = requiredRoles.filter(
    (role: string) => !memberRoles.includes(role),
  );

  return {
    meets: missingRoles.length === 0,
    missingRoles,
  };
}

function calculateAvailabilityStatus(
  member: any,
  shift: any,
  memberPreferences: Map<string, string[]>, // memberId -> shiftIds[]
  memberAssignments: Map<string, any[]>, // memberId -> assignments[]
  allShifts: any[],
): AvailabilityStatus {
  const memberId = member.id;
  const shiftId = shift.id;

  // Check preference
  const preferredShiftIds = memberPreferences.get(memberId) || [];
  const hasPreference = preferredShiftIds.includes(shiftId);

  // Check assignment
  const assignments = memberAssignments.get(memberId) || [];
  const isAssigned = assignments.some((a: any) => a.shiftId === shiftId);
  const assignment = assignments.find((a: any) => a.shiftId === shiftId);

  // Check conflicts (overlapping shifts)
  const shiftStart = new Date(shift.startTime);
  const shiftEnd = new Date(shift.endTime);
  const conflictingAssignments = assignments.filter((a: any) => {
    if (a.shiftId === shiftId) return false; // Don't count self
    const assignedShift = allShifts.find((s: any) => s.id === a.shiftId);
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
        ? member.preferences?.find((p: any) => p.shiftId === shiftId)?.id
        : undefined,
      assignmentId: assignment?.id,
      conflictShiftIds: conflictingAssignments.map((a: any) => a.shiftId),
      missingRoles: missingRoles.length > 0 ? missingRoles : undefined,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authResult = await checkAuth(request);
    if (!authResult.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const memberIdsParam = searchParams.get("memberIds");
    const shiftIdsParam = searchParams.get("shiftIds");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const shiftTypeParam = searchParams.get("shiftType");

    const memberIds = memberIdsParam
      ? memberIdsParam.split(",").filter(Boolean)
      : undefined;
    const shiftIds = shiftIdsParam
      ? shiftIdsParam.split(",").filter(Boolean)
      : undefined;
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    // Fetch members
    const membersWhere: any = { isActive: true };
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
    const shiftsWhere: any = {};
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
      shiftsWhere.type = shiftTypeParam;
    }

    const shifts = await prisma.shift.findMany({
      where: shiftsWhere,
      include: {
        requiredRoles: true,
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
    const memberAssignments = new Map<string, any[]>();

    members.forEach((member) => {
      const preferredShiftIds =
        member.preferences?.map((p: any) => p.shiftId) || [];
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
        genderRole: m.genderRole,
        capabilities: m.capabilities,
        isActive: m.isActive,
      })),
      shifts: shifts.map((s) => ({
        id: s.id,
        type: s.type,
        startTime: s.startTime,
        endTime: s.endTime,
        capacity: s.capacity,
        priority: s.priority,
        requiredRoles: s.requiredRoles?.map((r: any) => ({
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
  } catch (error) {
    console.error("Error fetching availability:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch availability data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
