// app/api/events/[id]/templates/[templateId]/route.ts
import { isAuthenticated, isAdmin } from "@/lib/auth";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { EventsService } from "@/lib/services/events.service";
import { RepositoryError } from "@/lib/repositories/base.repository";

const service = new EventsService();

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; templateId: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId, templateId } = await params;

    await service.unassignTemplate(eventId, templateId);

    return createSuccessResponse({ deleted: true });
  } catch (error) {
    console.error("Unassign template error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Template assignment");
    }

    return createErrorResponse(error, "Failed to unassign template");
  }
}
