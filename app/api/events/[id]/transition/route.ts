import { isAuthenticated } from "@/lib/auth";
import { EventsService } from "@/lib/services/events.service";
import { eventTransitionSchema } from "@/lib/validations/event-transition";
import { RepositoryError } from "@/lib/repositories/base.repository";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";

const service = new EventsService();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAuthenticated())) {
      return createUnauthorizedResponse();
    }

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
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }
    if (
      error instanceof Error &&
      error.message.includes("Invalid transition")
    ) {
      return createErrorResponse(error, error.message, 400);
    }
    if (error instanceof Error && error.message.includes("Cannot publish")) {
      return createErrorResponse(error, error.message, 400);
    }
    return createErrorResponse(error, "Failed to transition event status");
  }
}
