import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { isAdmin } from "@/lib/auth";
import {
  createErrorResponse,
  createSuccessResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { attributeDefinitionSchema } from "@/lib/validations/attribute";
import { EventRepository } from "@/lib/repositories/event.repository";
import { EventMetadataRepository } from "@/lib/repositories/event-metadata.repository";
const eventRepo = new EventRepository();
const metadataRepo = new EventMetadataRepository();

export const GET = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {
  const { id: eventId } = await params;

  await eventRepo.findById(eventId);

  const attributes = await metadataRepo.listEventAttributes(eventId);

  return createSuccessResponse(attributes);
}));

export const POST = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const admin = await isAdmin();
  if (!admin) return createForbiddenResponse("Admin access required");

  const { id: eventId } = await params;

  await eventRepo.findById(eventId);

  const body = await request.json();
  const validated = attributeDefinitionSchema.parse(body);

  // Check for duplicate attribute name
  const existing = await metadataRepo.listEventAttributes(eventId);
  if (existing.some((attr) => attr.name === validated.name)) {
    return createErrorResponse(
      new Error(
        `Attribute "${validated.name}" already exists for this event`,
      ),
      `Attribute "${validated.name}" already exists for this event`,
      409,
    );
  }

  const attribute = await metadataRepo.createEventAttribute(eventId, validated);

  return createSuccessResponse(attribute, 201);
}));
