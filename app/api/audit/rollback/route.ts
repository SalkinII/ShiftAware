import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/services/audit";
import {
  AuditAction,
  EntityType,
  Prisma,
  AuditLog,
  ExperienceLevel,
  Role,
  ShiftType,
  ShiftPriority,
  AssignmentType,
} from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
  createConflictResponse,
} from "@/lib/api-errors";

// Type definitions for rollback data
type TeamMemberBeforeAfter = {
  alias?: string;
  avatarId?: string;
  experienceLevel?: ExperienceLevel | string;
  genderRole?: string;
  capabilities?: Role[] | string[];
  isActive?: boolean;
};

type ShiftBeforeAfter = {
  eventId?: string;
  type?: ShiftType | string;
  startTime?: string | Date;
  endTime?: string | Date;
  durationMinutes?: number;
  priority?: ShiftPriority | string;
  desirabilityScore?: number;
  capacity?: number;
  requiredRoles?: Array<{ role: Role | string; count: number }>;
};

type AssignmentBeforeAfter = {
  shiftId?: string;
  teamMemberId?: string;
  role?: Role | string;
  isLead?: boolean;
  assignmentType?: AssignmentType | string;
  algorithmScore?: Prisma.InputJsonValue;
  notes?: string | null;
};

type PreferenceBeforeAfter = {
  teamMemberId?: string;
  shiftId?: string;
  priority?: number;
  notes?: string | null;
};

// Type guard helpers
function isValidExperienceLevel(value: unknown): value is ExperienceLevel {
  return (
    typeof value === "string" &&
    Object.values(ExperienceLevel).includes(value as ExperienceLevel)
  );
}

function isValidRole(value: unknown): value is Role {
  return (
    typeof value === "string" && Object.values(Role).includes(value as Role)
  );
}

function isValidShiftType(value: unknown): value is ShiftType {
  return (
    typeof value === "string" &&
    Object.values(ShiftType).includes(value as ShiftType)
  );
}

function isValidShiftPriority(value: unknown): value is ShiftPriority {
  return (
    typeof value === "string" &&
    Object.values(ShiftPriority).includes(value as ShiftPriority)
  );
}

function isValidAssignmentType(value: unknown): value is AssignmentType {
  return (
    typeof value === "string" &&
    Object.values(AssignmentType).includes(value as AssignmentType)
  );
}

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
  auditLog: AuditLog,
): Promise<{ success: boolean; message: string; action: AuditAction }> {
  const before = auditLog.before as unknown as TeamMemberBeforeAfter | null;
  const after = auditLog.after as unknown as TeamMemberBeforeAfter | null;

  switch (auditLog.action) {
    case AuditAction.CREATE:
      // Delete the member (soft delete)
      const createdMember = await tx.teamMember.findUnique({
        where: { id: auditLog.entityId },
      });
      if (!createdMember) {
        // Member already deleted (possibly already rolled back) - idempotent operation
        return {
          success: true,
          message: "Member already deleted (rollback already applied)",
          action: AuditAction.DELETE,
        };
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
          experienceLevel:
            before.experienceLevel &&
            isValidExperienceLevel(before.experienceLevel)
              ? before.experienceLevel
              : undefined,
          genderRole: before.genderRole,
          capabilities: before.capabilities
            ? (before.capabilities.filter((r): r is Role =>
                isValidRole(r),
              ) as Role[])
            : undefined,
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
  auditLog: AuditLog,
): Promise<{ success: boolean; message: string; action: AuditAction }> {
  const before = auditLog.before as unknown as ShiftBeforeAfter | null;
  const after = auditLog.after as unknown as ShiftBeforeAfter | null;

  switch (auditLog.action) {
    case AuditAction.CREATE:
      // Delete the shift (with related records)
      const createdShift = await tx.shift.findUnique({
        where: { id: auditLog.entityId },
        include: { requiredRoles: true },
      });
      if (!createdShift) {
        // Shift already deleted (possibly already rolled back) - idempotent operation
        return {
          success: true,
          message: "Shift already deleted (rollback already applied)",
          action: AuditAction.DELETE,
        };
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

        // Validate required fields
        if (
          !beforeShiftData.startTime ||
          !beforeShiftData.endTime ||
          !beforeShiftData.durationMinutes ||
          !beforeShiftData.capacity
        ) {
          throw new Error("Cannot rollback: missing required shift fields");
        }

        // Recreate the shift
        const recreatedShift = await tx.shift.create({
          data: {
            eventId: beforeShiftData.eventId,
            type: isValidShiftType(beforeShiftData.type)
              ? beforeShiftData.type
              : ShiftType.STATIONARY,
            startTime:
              beforeShiftData.startTime instanceof Date
                ? beforeShiftData.startTime
                : new Date(beforeShiftData.startTime),
            endTime:
              beforeShiftData.endTime instanceof Date
                ? beforeShiftData.endTime
                : new Date(beforeShiftData.endTime),
            durationMinutes: beforeShiftData.durationMinutes,
            priority: isValidShiftPriority(beforeShiftData.priority)
              ? beforeShiftData.priority
              : ShiftPriority.CORE,
            desirabilityScore: beforeShiftData.desirabilityScore ?? 3,
            capacity: beforeShiftData.capacity,
          },
        });

        // Recreate required roles
        if (beforeRoles && Array.isArray(beforeRoles)) {
          await tx.shiftRole.createMany({
            data: beforeRoles
              .filter((role) => isValidRole(role.role))
              .map((role) => ({
                shiftId: recreatedShift.id,
                role: role.role as Role,
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
          ...(shiftData.type &&
            isValidShiftType(shiftData.type) && { type: shiftData.type }),
          ...(shiftData.startTime && {
            startTime:
              shiftData.startTime instanceof Date
                ? shiftData.startTime
                : new Date(shiftData.startTime),
          }),
          ...(shiftData.endTime && {
            endTime:
              shiftData.endTime instanceof Date
                ? shiftData.endTime
                : new Date(shiftData.endTime),
          }),
          ...(shiftData.durationMinutes !== undefined && {
            durationMinutes: shiftData.durationMinutes,
          }),
          ...(shiftData.priority &&
            isValidShiftPriority(shiftData.priority) && {
              priority: shiftData.priority,
            }),
          ...(shiftData.desirabilityScore !== undefined && {
            desirabilityScore: shiftData.desirabilityScore,
          }),
          ...(shiftData.capacity !== undefined && {
            capacity: shiftData.capacity,
          }),
        },
      });

      // Restore required roles if they exist
      if (requiredRoles && Array.isArray(requiredRoles)) {
        await tx.shiftRole.deleteMany({
          where: { shiftId: auditLog.entityId },
        });
        if (requiredRoles.length > 0) {
          await tx.shiftRole.createMany({
            data: requiredRoles
              .filter((role) => isValidRole(role.role))
              .map((role) => ({
                shiftId: auditLog.entityId,
                role: role.role as Role,
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
      const { requiredRoles: deleteBeforeRoles, ...deleteBeforeShiftData } =
        before;

      // Validate required fields
      if (
        !deleteBeforeShiftData.eventId ||
        !deleteBeforeShiftData.type ||
        !deleteBeforeShiftData.startTime ||
        !deleteBeforeShiftData.endTime ||
        !deleteBeforeShiftData.durationMinutes ||
        !deleteBeforeShiftData.capacity
      ) {
        throw new Error("Cannot rollback: missing required shift fields");
      }

      // Recreate shift (IDs are auto-generated, so we can't reuse the original ID)
      const recreatedShiftDelete = await tx.shift.create({
        data: {
          eventId: deleteBeforeShiftData.eventId,
          type: isValidShiftType(deleteBeforeShiftData.type)
            ? deleteBeforeShiftData.type
            : ShiftType.STATIONARY,
          startTime:
            deleteBeforeShiftData.startTime instanceof Date
              ? deleteBeforeShiftData.startTime
              : new Date(deleteBeforeShiftData.startTime),
          endTime:
            deleteBeforeShiftData.endTime instanceof Date
              ? deleteBeforeShiftData.endTime
              : new Date(deleteBeforeShiftData.endTime),
          durationMinutes: deleteBeforeShiftData.durationMinutes,
          priority: isValidShiftPriority(deleteBeforeShiftData.priority)
            ? deleteBeforeShiftData.priority
            : ShiftPriority.CORE,
          desirabilityScore: deleteBeforeShiftData.desirabilityScore ?? 3,
          capacity: deleteBeforeShiftData.capacity,
        },
      });

      // Recreate required roles
      if (deleteBeforeRoles && Array.isArray(deleteBeforeRoles)) {
        await tx.shiftRole.createMany({
          data: deleteBeforeRoles
            .filter((role) => isValidRole(role.role))
            .map((role) => ({
              shiftId: recreatedShiftDelete.id,
              role: role.role as Role,
              count: role.count || 1,
            })),
        });
      }

      return {
        success: true,
        message: `Rolled back shift deletion: ${recreatedShiftDelete.type}`,
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
  auditLog: AuditLog,
): Promise<{ success: boolean; message: string; action: AuditAction }> {
  const before = auditLog.before as unknown as AssignmentBeforeAfter | null;
  const after = auditLog.after as unknown as AssignmentBeforeAfter | null;

  switch (auditLog.action) {
    case AuditAction.CREATE:
      // Delete the assignment
      const createdAssignment = await tx.assignment.findUnique({
        where: { id: auditLog.entityId },
      });
      if (!createdAssignment) {
        // Assignment already deleted (possibly already rolled back) - idempotent operation
        return {
          success: true,
          message: "Assignment already deleted (rollback already applied)",
          action: AuditAction.DELETE,
        };
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
          ...(before.role && isValidRole(before.role) && { role: before.role }),
          ...(before.isLead !== undefined && { isLead: before.isLead }),
          ...(before.assignmentType &&
            isValidAssignmentType(before.assignmentType) && {
              assignmentType: before.assignmentType,
            }),
          ...(before.algorithmScore !== undefined && {
            algorithmScore: before.algorithmScore,
          }),
          ...(before.notes !== undefined && { notes: before.notes }),
        },
      });
      return {
        success: true,
        message: "Rolled back assignment update",
        action: AuditAction.UPDATE,
      };

    case AuditAction.DELETE:
      // Recreate assignment from before
      if (!before || !before.shiftId || !before.teamMemberId || !before.role) {
        throw new Error("Cannot rollback: missing required assignment fields");
      }
      if (!isValidRole(before.role)) {
        throw new Error("Cannot rollback: invalid role");
      }
      await tx.assignment.create({
        data: {
          // IDs are auto-generated, so we can't reuse the original ID
          shiftId: before.shiftId,
          teamMemberId: before.teamMemberId,
          role: before.role,
          isLead: before.isLead || false,
          assignmentType:
            before.assignmentType &&
            isValidAssignmentType(before.assignmentType)
              ? before.assignmentType
              : AssignmentType.MANUAL,
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
  auditLog: AuditLog,
): Promise<{ success: boolean; message: string; action: AuditAction }> {
  const before = auditLog.before as unknown as PreferenceBeforeAfter | null;
  const after = auditLog.after as unknown as PreferenceBeforeAfter | null;

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
      if (
        !before ||
        !before.teamMemberId ||
        !before.shiftId ||
        before.priority === undefined
      ) {
        throw new Error("Cannot rollback: missing required preference fields");
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
