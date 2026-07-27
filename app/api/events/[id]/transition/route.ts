import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { EventRepository } from "@/lib/repositories/event.repository";
import {
  eventTransitionSchema,
  isValidTransition,
  STATUS_ORDER,
} from "@/lib/validations/event-transition";
import {
  createSuccessResponse,
} from "@/lib/api-errors";
import { createAuditLog } from "@/lib/utils/audit";
import { AuditAction, EntityType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const eventRepo = new EventRepository();

export const POST = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {
  const { id: eventId } = await params;
  const body = await request.json();
  const { targetStatus } = eventTransitionSchema.parse(body);

  const eventBefore = await eventRepo.findById(eventId);
  const oldStatus = eventBefore.status;

  const event = await eventRepo.findByIdWithShifts(eventId);

  if (!isValidTransition(event.status, targetStatus)) {
    throw new Error(
      `Invalid transition: cannot go from ${event.status} to ${targetStatus}`,
    );
  }

  // Forward-transition prerequisites
  const currentIdx = STATUS_ORDER.indexOf(event.status);
  const targetIdx = STATUS_ORDER.indexOf(
    targetStatus as (typeof STATUS_ORDER)[number],
  );
  const isForward = targetIdx > currentIdx;

  if (isForward) {
    if (
      event.status === "PLANNING" &&
      targetStatus === "OPEN_FOR_PREFERENCES"
    ) {
      if (!event.shifts || event.shifts.length === 0) {
        throw new Error("Cannot publish: event must have at least 1 shift");
      }
    }
  }

  const updated = await eventRepo.update(eventId, {
    status: targetStatus as Prisma.EventUpdateInput["status"],
  });

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
