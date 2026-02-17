// app/api/swap-requests/[id]/route.ts
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { updateSwapRequestSchema } from "@/lib/validations/swap-request";
import { SwapRequestsService } from "@/lib/services/swap-requests.service";
import { RepositoryError } from "@/lib/repositories/base.repository";

const service = new SwapRequestsService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id } = await params;

    const swapRequest = await service.getSwapRequest(id);

    return createSuccessResponse(swapRequest);
  } catch (error) {
    console.error("Get swap request error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Swap request");
    }

    return createErrorResponse(error, "Failed to fetch swap request");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin)
      return createForbiddenResponse(
        "Admin access required to approve/decline",
      );

    const { id } = await params;

    const body = await request.json();
    const validated = updateSwapRequestSchema.parse(body);

    let updated;
    if (validated.status === "APPROVED") {
      updated = await service.approveSwapRequest(id);
    } else {
      updated = await service.updateSwapRequest(id, validated.status);
    }

    try {
      await createAuditLog({
        action: AuditAction.MANUAL_SWAP,
        entityType: EntityType.ASSIGNMENT,
        entityId: id,
        after: { status: validated.status },
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });
    } catch (auditError) {
      console.error("Audit log failed:", auditError);
    }

    return createSuccessResponse(updated);
  } catch (error) {
    console.error("Update swap request error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Swap request");
    }

    return createErrorResponse(error, "Failed to update swap request");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id } = await params;

    const result = await service.cancelSwapRequest(id);

    try {
      await createAuditLog({
        action: AuditAction.DELETE,
        entityType: EntityType.ASSIGNMENT,
        entityId: id,
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });
    } catch (auditError) {
      console.error("Audit log failed:", auditError);
    }

    return createSuccessResponse(result);
  } catch (error) {
    console.error("Cancel swap request error:", error);

    if (error instanceof RepositoryError) {
      if (error.code === "NOT_FOUND") {
        return createNotFoundResponse("Swap request");
      }
      if (error.code === "INVALID_DATA") {
        return createErrorResponse(error, error.message, 400);
      }
    }

    return createErrorResponse(error, "Failed to cancel swap request");
  }
}
