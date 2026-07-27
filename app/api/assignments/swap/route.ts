import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { createAuditLog } from "@/lib/utils/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
} from "@/lib/api-errors";
import { AssignmentRepository } from "@/lib/repositories/assignment.repository";
import { swapAssignments } from "@/lib/domain/allocation";
import { RepositoryError } from "@/lib/repositories/base.repository";

const assignmentRepo = new AssignmentRepository();

export const POST = withAuth(withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const { assignment1Id, assignment2Id, reason } = body;

  if (!assignment1Id || !assignment2Id) {
    return createErrorResponse(
      new Error("Two assignments are required for a swap"),
      "Two assignments are required for a swap",
      400,
    );
  }

  try {
    // Get original assignments for audit
    const a1 = await assignmentRepo.findById(assignment1Id);
    const a2 = await assignmentRepo.findById(assignment2Id);

    // Perform swap
    const [newA1, newA2] = await swapAssignments(
      assignment1Id,
      assignment2Id,
    );

    // Create audit log
    await createAuditLog({
      action: AuditAction.MANUAL_SWAP,
      entityType: EntityType.ASSIGNMENT,
      entityId: `${a1.id}<->${a2.id}`,
      before: { a1: a1.teamMemberId, a2: a2.teamMemberId },
      after: { a1: a2.teamMemberId, a2: a1.teamMemberId },
      reason: reason || "Manual administrator swap",
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return createSuccessResponse({ success: true, a1: newA1, a2: newA2 });
  } catch (error: any) {
    // Domain-specific mappings not covered by withErrorHandling
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createErrorResponse(error, error.message, 404);
    }

    if (error instanceof Error) {
      if (error.message.includes("same shift")) {
        return createErrorResponse(error, error.message, 400);
      }
      if (error.message.includes("already assigned")) {
        return createErrorResponse(error, error.message, 409);
      }
    }

    if (error.code === "P2002") {
      return createErrorResponse(
        error,
        "Cannot swap: This would create a duplicate assignment. A member may already be assigned to one of these shifts.",
        409,
      );
    }

    if (error.code && error.code.startsWith("P")) {
      return createErrorResponse(
        error,
        `Database error: ${error.meta?.target || error.message}`,
        400,
      );
    }

    throw error;
  }
}));
