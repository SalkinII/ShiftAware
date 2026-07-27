import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { isAdmin } from "@/lib/auth";
import {
  createSuccessResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { reorderTemplatesSchema } from "@/lib/validations/event-template";
import { EventRepository } from "@/lib/repositories/event.repository";
import { EventMetadataRepository } from "@/lib/repositories/event-metadata.repository";
const eventRepo = new EventRepository();
const metadataRepo = new EventMetadataRepository();

export const PATCH = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const admin = await isAdmin();
  if (!admin) return createForbiddenResponse("Admin access required");

  const { id: eventId } = await params;

  await eventRepo.findById(eventId);

  const body = await request.json();
  const validated = reorderTemplatesSchema.parse(body);

  await metadataRepo.reorderEventTemplates(eventId, validated.order);

  return createSuccessResponse({ success: true });
}));
