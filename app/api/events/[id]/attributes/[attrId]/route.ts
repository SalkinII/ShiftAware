import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { isAdmin } from "@/lib/auth";
import {
  createSuccessResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { attributeDefinitionSchema } from "@/lib/validations/attribute";
import { EventMetadataRepository } from "@/lib/repositories/event-metadata.repository";
const metadataRepo = new EventMetadataRepository();

export const PUT = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string; attrId: string }> },) => {

  const admin = await isAdmin();
  if (!admin) return createForbiddenResponse("Admin access required");

  const { id: eventId, attrId } = await params;

  const body = await request.json();
  const validated = attributeDefinitionSchema.partial().parse(body);

  const updated = await metadataRepo.updateEventAttribute(
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

  await metadataRepo.deleteEventAttribute(eventId, attrId);

  return createSuccessResponse({ deleted: true });
}));
