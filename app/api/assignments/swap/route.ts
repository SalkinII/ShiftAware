import { isAuthenticated } from "@/lib/auth";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
} from "@/lib/api-errors";
import { AssignmentsService } from "@/lib/services/assignments.service";
import { RepositoryError } from "@/lib/repositories/base.repository";

const service = new AssignmentsService();

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const body = await request.json();
    const { assignment1Id, assignment2Id, reason } = body;

    if (!assignment1Id || !assignment2Id) {
      return createErrorResponse(
        new Error("Two assignments are required for a swap"),
        "Two assignments are required for a swap",
        400,
      );
    }

    // Get original assignments for audit
    const a1 = await service.getAssignment(assignment1Id);
    const a2 = await service.getAssignment(assignment2Id);

    // Perform swap
    const [newA1, newA2] = await service.swapAssignments(
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
    console.error("Swap assignments error:", error);

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

    // Handle Prisma unique constraint errors
    if (error.code === "P2002") {
      return createErrorResponse(
        error,
        "Cannot swap: This would create a duplicate assignment. A member may already be assigned to one of these shifts.",
        409,
      );
    }

    // Handle other Prisma errors
    if (error.code && error.code.startsWith("P")) {
      return createErrorResponse(
        error,
        `Database error: ${error.meta?.target || error.message}`,
        400,
      );
    }

    return createErrorResponse(error, "Failed to swap assignments");
  }
}
