import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType, Prisma } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
  createConflictResponse,
} from "@/lib/api-errors";

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const body = await request.json();
    const { auditLogId } = body;

    if (!auditLogId) {
      return createErrorResponse(
        new Error("auditLogId is required"),
        "Missing audit log ID",
        400,
      );
    }

    // Fetch audit log entry
    const auditLog = await prisma.auditLog.findUnique({
      where: { id: auditLogId },
    });

    if (!auditLog) {
      return createNotFoundResponse("Audit log entry");
    }

    // Prevent rolling back rollback entries (entries with reason containing "Rollback of")
    if (auditLog.reason && auditLog.reason.includes("Rollback of")) {
      return createConflictResponse(
        "Cannot rollback a rollback action. Please rollback the original action instead.",
      );
    }

    // Check if rollback is possible
    const rollbackableActions: AuditAction[] = [
      AuditAction.CREATE,
      AuditAction.UPDATE,
      AuditAction.DELETE,
      AuditAction.MANUAL_SWAP,
      AuditAction.PREFERENCE_SUBMIT, // Treated as CREATE for preferences
    ];

    if (!rollbackableActions.includes(auditLog.action)) {
      return createConflictResponse(
        `Cannot rollback ${auditLog.action} actions`,
      );
    }

    // Check for subsequent changes (warn but allow)
    const subsequentChanges = await prisma.auditLog.count({
      where: {
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        createdAt: { gt: auditLog.createdAt },
      },
    });

    // Execute rollback in transaction
    const result = await prisma.$transaction(async (tx) => {
      let rollbackResult: {
        success: boolean;
        message: string;
        action: AuditAction;
      };

      switch (auditLog.entityType) {
        case EntityType.TEAM_MEMBER:
          rollbackResult = await rollbackTeamMember(tx, auditLog);
          break;
        case EntityType.SHIFT:
          rollbackResult = await rollbackShift(tx, auditLog);
          break;
        case EntityType.ASSIGNMENT:
          rollbackResult = await rollbackAssignment(tx, auditLog);
          break;
        case EntityType.PREFERENCE:
          rollbackResult = await rollbackPreference(tx, auditLog);
          break;
        default:
          throw new Error(`Unsupported entity type: ${auditLog.entityType}`);
      }

      // Create audit log entry for rollback
      await tx.auditLog.create({
        data: {
          userId: auditLog.userId,
          action: AuditAction.UPDATE, // Use UPDATE to represent rollback
          entityType: auditLog.entityType,
          entityId: auditLog.entityId,
          before: auditLog.after ? (auditLog.after as object) : undefined, // Current state
          after: auditLog.before ? (auditLog.before as object) : undefined, // Rolled back state
          reason: `Rollback of ${auditLog.action} action from ${auditLog.createdAt.toISOString()}`,
          ipAddress: request.headers.get("x-forwarded-for") || undefined,
        },
      });

      return {
        ...rollbackResult,
        subsequentChanges,
      };
    });

    return createSuccessResponse({
      success: true,
      message: result.message,
      rolledBackAction: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      subsequentChanges: result.subsequentChanges,
    });
  } catch (error) {
    console.error("Rollback error:", error);
    return createErrorResponse(error, "Failed to rollback action");
  }
}

// Rollback functions for each entity type

async function rollbackTeamMember(
  tx: Prisma.TransactionClient,
  auditLog: any,
): Promise<{ success: boolean; message: string; action: AuditAction }> {
  const before = auditLog.before as any;
  const after = auditLog.after as any;

  switch (auditLog.action) {
    case AuditAction.CREATE:
      // Delete the member (soft delete)
      const createdMember = await tx.teamMember.findUnique({
        where: { id: auditLog.entityId },
      });
      if (!createdMember) {
        throw new Error("Member not found for rollback");
      }
      await tx.teamMember.update({
        where: { id: auditLog.entityId },
        data: { isActive: false },
      });
      return {
        success: true,
        message: `Rolled back member creation: ${createdMember.alias}`,
        action: AuditAction.DELETE,
      };

    case AuditAction.UPDATE:
      // Restore member fields from before
      if (!before) {
        throw new Error("Cannot rollback: missing 'before' data");
      }
      const existingMember = await tx.teamMember.findUnique({
        where: { id: auditLog.entityId },
      });
      if (!existingMember) {
        throw new Error("Member not found for rollback");
      }
      await tx.teamMember.update({
        where: { id: auditLog.entityId },
        data: {
          alias: before.alias,
          avatarId: before.avatarId,
          experienceLevel: before.experienceLevel,
          genderRole: before.genderRole,
          capabilities: before.capabilities,
          isActive: before.isActive,
        },
      });
      return {
        success: true,
        message: `Rolled back member update: ${existingMember.alias}`,
        action: AuditAction.UPDATE,
      };

    case AuditAction.DELETE:
      // Restore member (set isActive=true)
      if (!before) {
        throw new Error("Cannot rollback: missing 'before' data");
      }
      const deletedMember = await tx.teamMember.findUnique({
        where: { id: auditLog.entityId },
      });
      if (!deletedMember) {
        throw new Error("Member not found for rollback");
      }
      await tx.teamMember.update({
        where: { id: auditLog.entityId },
        data: { isActive: true },
      });
      return {
        success: true,
        message: `Rolled back member deletion: ${deletedMember.alias}`,
        action: AuditAction.CREATE,
      };

    default:
      throw new Error(
        `Unsupported action for member rollback: ${auditLog.action}`,
      );
  }
}

async function rollbackShift(
  tx: Prisma.TransactionClient,
  auditLog: any,
): Promise<{ success: boolean; message: string; action: AuditAction }> {
  const before = auditLog.before as any;
  const after = auditLog.after as any;

  switch (auditLog.action) {
    case AuditAction.CREATE:
      // Delete the shift (with related records)
      const createdShift = await tx.shift.findUnique({
        where: { id: auditLog.entityId },
        include: { requiredRoles: true },
      });
      if (!createdShift) {
        throw new Error("Shift not found for rollback");
      }

      // Check if shift has assignments
      const assignmentCount = await tx.assignment.count({
        where: { shiftId: auditLog.entityId },
      });
      if (assignmentCount > 0) {
        throw new Error(
          "Cannot rollback shift creation: shift has existing assignments",
        );
      }

      // Delete related records
      await tx.shiftRole.deleteMany({
        where: { shiftId: auditLog.entityId },
      });
      await tx.shiftPreference.deleteMany({
        where: { shiftId: auditLog.entityId },
      });
      await tx.shift.delete({
        where: { id: auditLog.entityId },
      });
      return {
        success: true,
        message: `Rolled back shift creation: ${createdShift.type}`,
        action: AuditAction.DELETE,
      };

    case AuditAction.UPDATE:
      // Restore shift fields from before
      // Note: This could be rolling back a rollback of a CREATE (which deleted the shift)
      // In that case, we need to recreate the shift instead of updating it
      if (!before) {
        throw new Error("Cannot rollback: missing 'before' data");
      }

      const existingShift = await tx.shift.findUnique({
        where: { id: auditLog.entityId },
        include: { requiredRoles: true },
      });

      // If shift doesn't exist, this might be a rollback of a CREATE rollback
      // Check if 'before' has all the data needed to recreate
      if (!existingShift) {
        // Try to recreate the shift from 'before' data
        const { requiredRoles: beforeRoles, ...beforeShiftData } = before;

        // Validate we have the required fields
        if (!beforeShiftData.eventId || !beforeShiftData.type) {
          throw new Error(
            "Cannot rollback: shift was deleted and missing data to recreate it",
          );
        }

        // Recreate the shift
        const recreatedShift = await tx.shift.create({
          data: {
            eventId: beforeShiftData.eventId,
            type: beforeShiftData.type,
            startTime: new Date(beforeShiftData.startTime),
            endTime: new Date(beforeShiftData.endTime),
            durationMinutes: beforeShiftData.durationMinutes,
            priority: beforeShiftData.priority,
            desirabilityScore: beforeShiftData.desirabilityScore,
            capacity: beforeShiftData.capacity,
          },
        });

        // Recreate required roles
        if (beforeRoles && Array.isArray(beforeRoles)) {
          await tx.shiftRole.createMany({
            data: beforeRoles.map((role: any) => ({
              shiftId: recreatedShift.id,
              role: role.role,
              count: role.count || 1,
            })),
          });
        }

        return {
          success: true,
          message: `Rolled back shift deletion: ${recreatedShift.type}`,
          action: AuditAction.CREATE,
        };
      }

      // Update shift fields
      const { requiredRoles, ...shiftData } = before;
      await tx.shift.update({
        where: { id: auditLog.entityId },
        data: {
          type: shiftData.type,
          startTime: new Date(shiftData.startTime),
          endTime: new Date(shiftData.endTime),
          durationMinutes: shiftData.durationMinutes,
          priority: shiftData.priority,
          desirabilityScore: shiftData.desirabilityScore,
          capacity: shiftData.capacity,
        },
      });

      // Restore required roles if they exist
      if (requiredRoles && Array.isArray(requiredRoles)) {
        await tx.shiftRole.deleteMany({
          where: { shiftId: auditLog.entityId },
        });
        if (requiredRoles.length > 0) {
          await tx.shiftRole.createMany({
            data: requiredRoles.map((role: any) => ({
              shiftId: auditLog.entityId,
              role: role.role,
              count: role.count || 1,
            })),
          });
        }
      }

      return {
        success: true,
        message: `Rolled back shift update: ${existingShift.type}`,
        action: AuditAction.UPDATE,
      };

    case AuditAction.DELETE:
      // Recreate shift from before
      if (!before) {
        throw new Error("Cannot rollback: missing 'before' data");
      }
      const { requiredRoles: beforeRoles, ...beforeShiftData } = before;

      // Recreate shift (IDs are auto-generated, so we can't reuse the original ID)
      const recreatedShift = await tx.shift.create({
        data: {
          eventId: beforeShiftData.eventId,
          type: beforeShiftData.type,
          startTime: new Date(beforeShiftData.startTime),
          endTime: new Date(beforeShiftData.endTime),
          durationMinutes: beforeShiftData.durationMinutes,
          priority: beforeShiftData.priority,
          desirabilityScore: beforeShiftData.desirabilityScore,
          capacity: beforeShiftData.capacity,
        },
      });

      // Recreate required roles
      if (beforeRoles && Array.isArray(beforeRoles)) {
        await tx.shiftRole.createMany({
          data: beforeRoles.map((role: any) => ({
            shiftId: recreatedShift.id,
            role: role.role,
            count: role.count || 1,
          })),
        });
      }

      return {
        success: true,
        message: `Rolled back shift deletion: ${recreatedShift.type}`,
        action: AuditAction.CREATE,
      };

    default:
      throw new Error(
        `Unsupported action for shift rollback: ${auditLog.action}`,
      );
  }
}

async function rollbackAssignment(
  tx: Prisma.TransactionClient,
  auditLog: any,
): Promise<{ success: boolean; message: string; action: AuditAction }> {
  const before = auditLog.before as any;
  const after = auditLog.after as any;

  switch (auditLog.action) {
    case AuditAction.CREATE:
      // Delete the assignment
      const createdAssignment = await tx.assignment.findUnique({
        where: { id: auditLog.entityId },
      });
      if (!createdAssignment) {
        throw new Error("Assignment not found for rollback");
      }
      await tx.assignment.delete({
        where: { id: auditLog.entityId },
      });
      return {
        success: true,
        message: "Rolled back assignment creation",
        action: AuditAction.DELETE,
      };

    case AuditAction.UPDATE:
      // Restore assignment fields from before
      if (!before) {
        throw new Error("Cannot rollback: missing 'before' data");
      }
      const existingAssignment = await tx.assignment.findUnique({
        where: { id: auditLog.entityId },
      });
      if (!existingAssignment) {
        throw new Error("Assignment not found for rollback");
      }
      await tx.assignment.update({
        where: { id: auditLog.entityId },
        data: {
          role: before.role,
          isLead: before.isLead,
          assignmentType: before.assignmentType,
          algorithmScore: before.algorithmScore,
          notes: before.notes,
        },
      });
      return {
        success: true,
        message: "Rolled back assignment update",
        action: AuditAction.UPDATE,
      };

    case AuditAction.DELETE:
      // Recreate assignment from before
      if (!before) {
        throw new Error("Cannot rollback: missing 'before' data");
      }
      await tx.assignment.create({
        data: {
          // IDs are auto-generated, so we can't reuse the original ID
          shiftId: before.shiftId,
          teamMemberId: before.teamMemberId,
          role: before.role,
          isLead: before.isLead || false,
          assignmentType: before.assignmentType,
          algorithmScore: before.algorithmScore,
          notes: before.notes,
        },
      });
      return {
        success: true,
        message: "Rolled back assignment deletion",
        action: AuditAction.CREATE,
      };

    case AuditAction.MANUAL_SWAP:
      // Reverse swap: swap back
      if (!before || !after) {
        throw new Error(
          "Cannot rollback swap: missing 'before' or 'after' data",
        );
      }
      // Extract swap information from audit log
      // Note: This is simplified - actual swap rollback may need more context
      // For now, we'll need to parse the reason or store swap details
      throw new Error(
        "Manual swap rollback not yet implemented - requires swap context",
      );

    default:
      throw new Error(
        `Unsupported action for assignment rollback: ${auditLog.action}`,
      );
  }
}

async function rollbackPreference(
  tx: Prisma.TransactionClient,
  auditLog: any,
): Promise<{ success: boolean; message: string; action: AuditAction }> {
  const before = auditLog.before as any;
  const after = auditLog.after as any;

  switch (auditLog.action) {
    case AuditAction.CREATE:
    case AuditAction.PREFERENCE_SUBMIT:
      // Delete the preference (PREFERENCE_SUBMIT is treated as CREATE)
      const createdPreference = await tx.shiftPreference.findUnique({
        where: { id: auditLog.entityId },
      });
      if (!createdPreference) {
        // Preference might have been deleted already, that's okay
        return {
          success: true,
          message: "Preference already deleted",
          action: AuditAction.DELETE,
        };
      }
      await tx.shiftPreference.delete({
        where: { id: auditLog.entityId },
      });
      return {
        success: true,
        message: "Rolled back preference creation",
        action: AuditAction.DELETE,
      };

    case AuditAction.UPDATE:
      // Restore preference from before
      if (!before) {
        throw new Error("Cannot rollback: missing 'before' data");
      }
      const existingPreference = await tx.shiftPreference.findUnique({
        where: { id: auditLog.entityId },
      });
      if (!existingPreference) {
        throw new Error("Preference not found for rollback");
      }
      await tx.shiftPreference.update({
        where: { id: auditLog.entityId },
        data: {
          priority: before.priority,
          notes: before.notes,
        },
      });
      return {
        success: true,
        message: "Rolled back preference update",
        action: AuditAction.UPDATE,
      };

    case AuditAction.DELETE:
      // Recreate preference from before
      if (!before) {
        throw new Error("Cannot rollback: missing 'before' data");
      }
      await tx.shiftPreference.create({
        data: {
          // IDs are auto-generated, so we can't reuse the original ID
          teamMemberId: before.teamMemberId,
          shiftId: before.shiftId,
          priority: before.priority,
          notes: before.notes,
        },
      });
      return {
        success: true,
        message: "Rolled back preference deletion",
        action: AuditAction.CREATE,
      };

    default:
      throw new Error(
        `Unsupported action for preference rollback: ${auditLog.action}`,
      );
  }
}
