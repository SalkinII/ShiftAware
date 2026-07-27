import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { isAdmin } from "@/lib/auth";
import { EventRepository } from "@/lib/repositories/event.repository";
import { assertEventStatusAllows } from "@/lib/domain/event-status";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { createAuditLog } from "@/lib/utils/audit";
import { AuditAction, EntityType } from "@prisma/client";
import { updateEventSchema } from "@/lib/validations/event";
const eventRepo = new EventRepository();

export const GET = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const { id } = await params;
  const event = await eventRepo.findById(id);
  return createSuccessResponse(event);
}));

export const PUT = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {
  if (!(await isAdmin())) {
    return createUnauthorizedResponse();
  }

  const { id } = await params;
  const body = await request.json();

  const validation = updateEventSchema.safeParse({ ...body, id });
  if (!validation.success) {
    return createErrorResponse(
      new Error(validation.error.errors[0].message),
      validation.error.errors[0].message,
      400,
    );
  }

  const { startDate, endDate, ...eventFields } = validation.data;

  // Convert date strings to Date objects for Prisma
  const eventData: Record<string, unknown> = { ...eventFields };
  if (startDate) eventData.startDate = new Date(startDate);
  if (endDate) eventData.endDate = new Date(endDate);

  // Remove id from the update payload (it's in the where clause)
  delete eventData.id;

  await assertEventStatusAllows(id, "EVENT_MUTATE");
  const event = await eventRepo.update(id, eventData as any);

  await createAuditLog({
    action: AuditAction.UPDATE,
    entityType: EntityType.EVENT,
    entityId: id,
    after: validation.data,
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
  });

  return createSuccessResponse(event);
}));

export const DELETE = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {
  if (!(await isAdmin())) {
    return createUnauthorizedResponse();
  }

  const { id } = await params;

  const event = await eventRepo.findById(id);
  if (!event) {
    return createNotFoundResponse("Event");
  }

  await assertEventStatusAllows(id, "EVENT_DELETE");
  await eventRepo.permanentDelete(id);

  await createAuditLog({
    action: AuditAction.DELETE,
    entityType: EntityType.EVENT,
    entityId: id,
    before: { id: event.id, name: event.name, status: event.status },
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
  });

  return createSuccessResponse({ success: true });
}));
