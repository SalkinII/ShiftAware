import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
// app/api/events/[id]/templates/[templateId]/route.ts
import { isAdmin } from "@/lib/auth";
import {
  createSuccessResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { EventMetadataRepository } from "@/lib/repositories/event-metadata.repository";
const metadataRepo = new EventMetadataRepository();

export const DELETE = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string; templateId: string }> },) => {

  const admin = await isAdmin();
  if (!admin) return createForbiddenResponse("Admin access required");

  const { id: eventId, templateId } = await params;

  await metadataRepo.deleteEventTemplate(eventId, templateId);

  return createSuccessResponse({ deleted: true });
}));
