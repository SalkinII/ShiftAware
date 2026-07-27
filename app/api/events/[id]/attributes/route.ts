import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { isAdmin } from "@/lib/auth";
import {
  createErrorResponse,
  createSuccessResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { attributeDefinitionSchema } from "@/lib/validations/attribute";
import { EventsService } from "@/lib/services/events.service";
const service = new EventsService();

export const GET = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {
  const { id: eventId } = await params;

  await service.getEvent(eventId);

  const attributes = await service.listEventAttributes(eventId);

  return createSuccessResponse(attributes);
}));

export const POST = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const admin = await isAdmin();
  if (!admin) return createForbiddenResponse("Admin access required");

  const { id: eventId } = await params;

  await service.getEvent(eventId);

  const body = await request.json();
  const validated = attributeDefinitionSchema.parse(body);

  // Check for duplicate attribute name
  const existing = await service.listEventAttributes(eventId);
  if (existing.some((attr) => attr.name === validated.name)) {
    return createErrorResponse(
      new Error(
        `Attribute "${validated.name}" already exists for this event`,
      ),
      `Attribute "${validated.name}" already exists for this event`,
      409,
    );
  }

  const attribute = await service.createEventAttribute(eventId, validated);

  return createSuccessResponse(attribute, 201);
}));
