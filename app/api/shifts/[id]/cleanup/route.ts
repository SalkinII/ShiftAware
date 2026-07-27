import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createSuccessResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
/**
 * Cleanup endpoint for orphaned shifts that cannot be deleted normally.
 * Removes assignments, preferences, roles, and the shift itself.
 * Use with caution - this bypasses normal validation.
 */
export const DELETE = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {
  const { id: shiftId } = await params;

  // Get shift before deletion for audit log
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      requiredRoles: true,
      assignments: {
        include: { teamMember: true },
      },
      preferences: {
        include: { teamMember: true },
      },
    },
  });

  if (!shift) {
    return createNotFoundResponse("Shift");
  }

  // Get counts for reporting
  const assignmentCount = shift.assignments.length;
  const preferenceCount = shift.preferences.length;
  const roleCount = shift.requiredRoles.length;

  // Force delete everything in a transaction
  await prisma.$transaction(async (tx) => {
    // Delete assignments first
    await tx.assignment.deleteMany({
      where: { shiftId },
    });

    // Delete preferences
    await tx.shiftPreference.deleteMany({
      where: { shiftId },
    });

    // Delete required roles
    await tx.shiftRole.deleteMany({
      where: { shiftId },
    });

    // Finally delete the shift
    await tx.shift.delete({
      where: { id: shiftId },
    });
  });

  // Create audit log
  await createAuditLog({
    action: AuditAction.DELETE,
    entityType: EntityType.SHIFT,
    entityId: shift.id,
    before: shift,
    reason: `Cleanup: removed ${assignmentCount} assignment(s), ${preferenceCount} preference(s), ${roleCount} role(s)`,
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
  });

  return createSuccessResponse({
    success: true,
    message: `Cleaned up shift ${shift.type}`,
    deleted: {
      assignments: assignmentCount,
      preferences: preferenceCount,
      roles: roleCount,
    },
  });
}));
