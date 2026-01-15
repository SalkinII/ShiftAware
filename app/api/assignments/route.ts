import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import { runAssignmentAlgorithm } from "@/lib/algorithm/optimizer";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";

export async function GET(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const teamMemberId = searchParams.get("teamMemberId");

    const assignments = await prisma.assignment.findMany({
      where: {
        ...(eventId && {
          shift: { eventId },
        }),
        ...(teamMemberId && { teamMemberId }),
      },
      include: {
        shift: {
          include: {
            event: true,
            requiredRoles: true,
          },
        },
        teamMember: true,
      },
      orderBy: [
        { shift: { startTime: "asc" } },
        { teamMember: { alias: "asc" } },
      ],
    });

    return createSuccessResponse(assignments);
  } catch (error) {
    console.error("Get assignments error:", error);
    return createErrorResponse(error, "Failed to fetch assignments");
  }
}

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const body = await request.json();
    const { eventId } = body;

    if (!eventId) {
      return createErrorResponse(
        new Error("eventId is required"),
        "eventId is required",
        400,
      );
    }

    // Get event and config
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { config: true },
    });

    if (!event) {
      return createNotFoundResponse("Event");
    }

    // Get all active members
    const members = await prisma.teamMember.findMany({
      where: { isActive: true },
      include: {
        preferences: {
          include: { shift: true },
        },
        assignments: {
          include: { shift: true },
        },
      },
    });

    // Get all shifts for event
    const shifts = await prisma.shift.findMany({
      where: { eventId },
      include: {
        preferences: {
          include: { teamMember: true },
        },
        assignments: {
          include: { teamMember: true },
        },
        requiredRoles: true,
        event: true,
      },
      orderBy: { startTime: "asc" },
    });

    // Get core shifts (priority = CORE)
    const coreShifts = shifts.filter((s) => s.priority === "CORE");

    // Delete existing assignments for this event
    await prisma.assignment.deleteMany({
      where: {
        shift: { eventId },
      },
    });

    // Run algorithm
    const config = event.config || {
      minShiftsPerPerson: 2,
      algorithmWeights: {
        preferenceMatch: 0.35,
        experienceBalance: 0.25,
        workloadFairness: 0.15,
        coreShiftCoverage: 0.05,
      },
    };

    const weights =
      typeof config.algorithmWeights === "object" &&
      config.algorithmWeights !== null
        ? (config.algorithmWeights as any)
        : {
            preferenceMatch: 0.35,
            experienceBalance: 0.25,
            workloadFairness: 0.15,
            coreShiftCoverage: 0.05,
          };

    const result = await runAssignmentAlgorithm(members as any, shifts as any, {
      minShiftsPerPerson: config.minShiftsPerPerson || 2,
      coreShifts,
      weights,
    });

    // Save assignments to database
    const savedAssignments = await prisma.$transaction(
      result.assignments.map((assignment) =>
        prisma.assignment.create({
          data: {
            shiftId: assignment.shiftId,
            teamMemberId: assignment.teamMemberId,
            role: assignment.role,
            isLead: assignment.isLead || false,
            assignmentType: assignment.assignmentType,
            algorithmScore: result.scores.get(
              `${assignment.teamMemberId}-${assignment.shiftId}`,
            )
              ? (result.scores.get(
                  `${assignment.teamMemberId}-${assignment.shiftId}`,
                ) as any)
              : null,
            notes:
              result.explanations.get(
                `${assignment.teamMemberId}-${assignment.shiftId}`,
              ) || null,
          },
          include: {
            shift: true,
            teamMember: true,
          },
        }),
      ),
    );

    await createAuditLog({
      action: AuditAction.ASSIGNMENT_RUN,
      entityType: EntityType.CONFIG,
      entityId: eventId,
      after: {
        assignmentsCount: savedAssignments.length,
        violations: result.violations,
      },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return createSuccessResponse({
      assignments: savedAssignments,
      violations: result.violations,
      scores: Object.fromEntries(result.scores),
      explanations: Object.fromEntries(result.explanations),
    });
  } catch (error) {
    console.error("Run assignment algorithm error:", error);
    return createErrorResponse(error, "Failed to run assignment algorithm");
  }
}
