import { isAuthenticated, isAdmin } from "@/lib/auth";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { reorderTemplatesSchema } from "@/lib/validations/event-template";
import { EventsService } from "@/lib/services/events.service";
import { RepositoryError } from "@/lib/repositories/base.repository";

const service = new EventsService();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId } = await params;

    await service.getEvent(eventId);

    const body = await request.json();
    const validated = reorderTemplatesSchema.parse(body);

    await service.reorderEventTemplates(eventId, validated.order);

    return createSuccessResponse({ success: true });
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }
    return createErrorResponse(error, "Failed to reorder templates");
  }
}
