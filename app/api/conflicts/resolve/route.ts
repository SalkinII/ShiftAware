import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
} from "@/lib/api-errors";

interface ResolutionRequest {
  conflictId: string;
  resolution: {
    action: "SWAP" | "UNASSIGN" | "ASSIGN" | "REASSIGN";
    assignmentIds?: string[];
    memberId?: string;
    shiftId?: string;
    targetMemberId?: string;
    targetShiftId?: string;
  };
}

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const body: ResolutionRequest = await request.json();
    const { conflictId, resolution } = body;

    if (!conflictId || !resolution) {
      return createErrorResponse(
        new Error("conflictId and resolution are required"),
        "Missing required fields",
        400,
      );
    }

    // Apply resolution in transaction
    let auditData: {
      action: AuditAction;
      entityType: EntityType;
      entityId: string;
      before?: unknown;
      after?: unknown;
    }[] = [];

    const result = await prisma.$transaction(async (tx) => {
      switch (resolution.action) {
        case "UNASSIGN":
          if (
            !resolution.assignmentIds ||
            resolution.assignmentIds.length === 0
          ) {
            throw new Error("assignmentIds required for UNASSIGN");
          }

          // Get assignments before deletion for audit
          const assignmentsToDelete = await tx.assignment.findMany({
            where: { id: { in: resolution.assignmentIds } },
            include: { shift: true, teamMember: true },
          });

          // Delete assignments
          await tx.assignment.deleteMany({
            where: { id: { in: resolution.assignmentIds } },
          });

          // Store audit data for after transaction
          assignmentsToDelete.forEach((assignment) => {
            auditData.push({
              action: AuditAction.DELETE,
              entityType: EntityType.ASSIGNMENT,
              entityId: assignment.id,
              before: assignment,
            });
          });

          return {
            success: true,
            message: `Unassigned ${assignmentsToDelete.length} member(s)`,
            resolved: true,
          };

        case "ASSIGN":
          if (!resolution.targetMemberId || !resolution.targetShiftId) {
            throw new Error(
              "targetMemberId and targetShiftId required for ASSIGN",
            );
          }

          // Check if assignment already exists
          const existing = await tx.assignment.findUnique({
            where: {
              shiftId_teamMemberId: {
                shiftId: resolution.targetShiftId,
                teamMemberId: resolution.targetMemberId,
              },
            },
          });

          if (existing) {
            throw new Error("Assignment already exists");
          }

          // Get shift to determine role
          const shift = await tx.shift.findUnique({
            where: { id: resolution.targetShiftId },
            include: { requiredRoles: true },
          });

          if (!shift) {
            throw new Error("Shift not found");
          }

          // Determine role (use first required role or default to TEAM_MEMBER)
          const requiredRole = shift.requiredRoles[0]?.role || "TEAM_MEMBER";
          const isLead = requiredRole === "SHIFT_LEAD";

          // Create assignment
          const newAssignment = await tx.assignment.create({
            data: {
              shiftId: resolution.targetShiftId,
              teamMemberId: resolution.targetMemberId,
              role: requiredRole as any,
              isLead,
              assignmentType: "MANUAL",
            },
            include: { shift: true, teamMember: true },
          });

          // Store audit data for after transaction
          auditData.push({
            action: AuditAction.CREATE,
            entityType: EntityType.ASSIGNMENT,
            entityId: newAssignment.id,
            after: newAssignment,
          });

          return {
            success: true,
            message: `Assigned ${newAssignment.teamMember.alias} to ${newAssignment.shift.type}`,
            resolved: true,
          };

        case "REASSIGN":
          if (
            !resolution.assignmentIds ||
            resolution.assignmentIds.length !== 1 ||
            !resolution.targetShiftId
          ) {
            throw new Error(
              "Single assignmentId and targetShiftId required for REASSIGN",
            );
          }

          const assignmentToMove = await tx.assignment.findUnique({
            where: { id: resolution.assignmentIds[0] },
            include: { shift: true, teamMember: true },
          });

          if (!assignmentToMove) {
            throw new Error("Assignment not found");
          }

          // Check if target shift assignment exists
          const targetExists = await tx.assignment.findUnique({
            where: {
              shiftId_teamMemberId: {
                shiftId: resolution.targetShiftId,
                teamMemberId: assignmentToMove.teamMemberId,
              },
            },
          });

          if (targetExists) {
            throw new Error("Member already assigned to target shift");
          }

          // Delete old assignment and create new one
          const before = { ...assignmentToMove };
          await tx.assignment.delete({
            where: { id: assignmentToMove.id },
          });

          const movedAssignment = await tx.assignment.create({
            data: {
              shiftId: resolution.targetShiftId,
              teamMemberId: assignmentToMove.teamMemberId,
              role: assignmentToMove.role,
              isLead: assignmentToMove.isLead,
              assignmentType: "MANUAL",
            },
            include: { shift: true, teamMember: true },
          });

          // Store audit data for after transaction
          auditData.push({
            action: AuditAction.UPDATE,
            entityType: EntityType.ASSIGNMENT,
            entityId: movedAssignment.id,
            before,
            after: movedAssignment,
          });

          return {
            success: true,
            message: `Moved ${movedAssignment.teamMember.alias} from ${before.shift.type} to ${movedAssignment.shift.type}`,
            resolved: true,
          };

        case "SWAP":
          // Use existing swap endpoint logic
          if (
            !resolution.assignmentIds ||
            resolution.assignmentIds.length !== 2 ||
            !resolution.targetMemberId
          ) {
            throw new Error(
              "Two assignmentIds and targetMemberId required for SWAP",
            );
          }

          // Get assignments
          const [a1, a2] = await Promise.all([
            tx.assignment.findUnique({
              where: { id: resolution.assignmentIds[0] },
              include: { shift: true, teamMember: true },
            }),
            tx.assignment.findUnique({
              where: { id: resolution.assignmentIds[1] },
              include: { shift: true, teamMember: true },
            }),
          ]);

          if (!a1 || !a2) {
            throw new Error("One or both assignments not found");
          }

          // Perform swap (delete + create pattern)
          await tx.assignment.deleteMany({
            where: { id: { in: [a1.id, a2.id] } },
          });

          const swappedA1 = await tx.assignment.create({
            data: {
              shiftId: a1.shiftId,
              teamMemberId: a2.teamMemberId,
              role: a1.role,
              isLead: a1.isLead,
              assignmentType: "SWAP",
            },
          });

          const swappedA2 = await tx.assignment.create({
            data: {
              shiftId: a2.shiftId,
              teamMemberId: a1.teamMemberId,
              role: a2.role,
              isLead: a2.isLead,
              assignmentType: "SWAP",
            },
          });

          // Store audit data for after transaction
          auditData.push({
            action: AuditAction.MANUAL_SWAP,
            entityType: EntityType.ASSIGNMENT,
            entityId: swappedA1.id,
            before: { assignment1: a1, assignment2: a2 },
            after: { assignment1: swappedA1, assignment2: swappedA2 },
          });

          return {
            success: true,
            message: `Swapped ${a1.teamMember.alias} and ${a2.teamMember.alias}`,
            resolved: true,
          };

        default:
          throw new Error(
            `Unsupported resolution action: ${resolution.action}`,
          );
      }
    });

    // Create audit logs after transaction commits
    const ipAddress = request.headers.get("x-forwarded-for") || undefined;
    for (const audit of auditData) {
      await createAuditLog({
        ...audit,
        reason: `Conflict resolution: ${conflictId}`,
        ipAddress,
      });
    }

    return createSuccessResponse({
      success: result.success,
      message: result.message,
      resolved: result.resolved,
    });
  } catch (error) {
    console.error("Resolve conflict error:", error);
    return createErrorResponse(error, "Failed to resolve conflict");
  }
}
