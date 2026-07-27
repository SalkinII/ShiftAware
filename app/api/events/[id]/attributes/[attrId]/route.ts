import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { isAdmin } from "@/lib/auth";
import {
  createSuccessResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { attributeDefinitionSchema } from "@/lib/validations/attribute";
import { EventRepository } from "@/lib/repositories/event.repository";
const eventRepo = new EventRepository();

export const PUT = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string; attrId: string }> },) => {

  const admin = await isAdmin();
  if (!admin) return createForbiddenResponse("Admin access required");

  const { id: eventId, attrId } = await params;

  const body = await request.json();
  const validated = attributeDefinitionSchema.partial().parse(body);

  const updated = await eventRepo.updateEventAttribute(
    eventId,
    attrId,
    validated,
  );

  return createSuccessResponse(updated);
}));

export const DELETE = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string; attrId: string }> },) => {

  const admin = await isAdmin();
  if (!admin) return createForbiddenResponse("Admin access required");

  const { id: eventId, attrId } = await params;

  await eventRepo.deleteEventAttribute(eventId, attrId);

  return createSuccessResponse({ deleted: true });
}));
