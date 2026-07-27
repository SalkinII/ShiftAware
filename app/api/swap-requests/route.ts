import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
// app/api/swap-requests/route.ts
import { createAuditLog } from "@/lib/utils/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createSuccessResponse,
} from "@/lib/api-errors";
import { createSwapRequestSchema } from "@/lib/validations/swap-request";
import { SwapRequestRepository } from "@/lib/repositories/swap-request.repository";
import { createSwapRequest } from "@/lib/domain/swap";

const swapRepo = new SwapRequestRepository();

export const GET = withAuth(withErrorHandling(async (request: Request) => {

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");
  const eventId = searchParams.get("eventId");
  const status = searchParams.get("status");

  const where: any = {};

  if (memberId) {
    where.requesterId = memberId;
  }

  if (eventId) {
    where.toShift = { eventId };
  }

  if (status) {
    where.status = status;
  }

  const requests = await swapRepo.findAll(where);

  return createSuccessResponse(requests);
}));

export const POST = withAuth(withErrorHandling(async (request: Request) => {

  const body = await request.json();
  const validated = createSwapRequestSchema.parse(body);

  const swapRequest = await createSwapRequest(
    validated.fromAssignmentId,
    validated.toShiftId,
  );

  try {
    await createAuditLog({
      action: AuditAction.CREATE,
      entityType: EntityType.ASSIGNMENT,
      entityId: swapRequest.id,
      after: {
        fromAssignmentId: validated.fromAssignmentId,
        toShiftId: validated.toShiftId,
        status: "PENDING",
      },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });
  } catch (auditError) {
    console.error("Audit log failed:", auditError);
  }

  return createSuccessResponse(swapRequest, 201);
}));
