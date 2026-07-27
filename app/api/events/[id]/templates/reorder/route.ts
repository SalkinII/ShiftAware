import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { isAdmin } from "@/lib/auth";
import {
  createSuccessResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { reorderTemplatesSchema } from "@/lib/validations/event-template";
import { EventsService } from "@/lib/services/events.service";
const service = new EventsService();

export const PATCH = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const admin = await isAdmin();
  if (!admin) return createForbiddenResponse("Admin access required");

  const { id: eventId } = await params;

  await service.getEvent(eventId);

  const body = await request.json();
  const validated = reorderTemplatesSchema.parse(body);

  await service.reorderEventTemplates(eventId, validated.order);

  return createSuccessResponse({ success: true });
}));
