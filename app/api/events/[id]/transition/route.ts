import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { EventsService } from "@/lib/services/events.service";
import { eventTransitionSchema } from "@/lib/validations/event-transition";
import {
  createSuccessResponse,
} from "@/lib/api-errors";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";

const service = new EventsService();

export const POST = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {
  const { id: eventId } = await params;
  const body = await request.json();
  const { targetStatus } = eventTransitionSchema.parse(body);

  const eventBefore = await service.getEvent(eventId);
  const oldStatus = eventBefore.status;

  const updated = await service.transitionStatus(eventId, targetStatus);

  await createAuditLog({
    action: AuditAction.UPDATE,
    entityType: EntityType.EVENT,
    entityId: eventId,
    before: { status: oldStatus },
    after: { status: targetStatus },
    reason: `Status transition to ${targetStatus}`,
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
  });

  return createSuccessResponse(updated);
}));
