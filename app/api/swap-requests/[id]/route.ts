import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
// app/api/swap-requests/[id]/route.ts
import { isAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createSuccessResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { updateSwapRequestSchema } from "@/lib/validations/swap-request";
import { SwapRequestsService } from "@/lib/services/swap-requests.service";
const service = new SwapRequestsService();

export const GET = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const { id } = await params;

  const swapRequest = await service.getSwapRequest(id);

  return createSuccessResponse(swapRequest);
}));

export const PUT = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

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
  } else if (validated.status === "DECLINED") {
    updated = await service.declineSwapRequest(id);
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
}));

export const DELETE = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

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
}));
