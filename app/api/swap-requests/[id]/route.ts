import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
// app/api/swap-requests/[id]/route.ts
import { isAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/utils/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createSuccessResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { updateSwapRequestSchema } from "@/lib/validations/swap-request";
import { SwapRequestRepository } from "@/lib/repositories/swap-request.repository";
import {
  approveSwapRequest,
  cancelSwapRequest,
  declineSwapRequest,
} from "@/lib/domain/swap";

const swapRepo = new SwapRequestRepository();

export const GET = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const { id } = await params;

  const swapRequest = await swapRepo.findById(id);

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
    updated = await approveSwapRequest(id);
  } else if (validated.status === "DECLINED") {
    updated = await declineSwapRequest(id);
  } else {
    updated = await swapRepo.update(id, { status: validated.status as any });
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

  const result = await cancelSwapRequest(id);

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
