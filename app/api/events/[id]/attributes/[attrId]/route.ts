import { isAuthenticated, isAdmin } from "@/lib/auth";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { attributeDefinitionSchema } from "@/lib/validations/attribute";
import { EventsService } from "@/lib/services/events.service";
import { RepositoryError } from "@/lib/repositories/base.repository";

const service = new EventsService();

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; attrId: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId, attrId } = await params;

    const body = await request.json();
    const validated = attributeDefinitionSchema.partial().parse(body);

    const updated = await service.updateEventAttribute(
      eventId,
      attrId,
      validated,
    );

    return createSuccessResponse(updated);
  } catch (error) {
    console.error("Update attribute error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Attribute");
    }

    return createErrorResponse(error, "Failed to update attribute");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; attrId: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId, attrId } = await params;

    await service.deleteEventAttribute(eventId, attrId);

    return createSuccessResponse({ deleted: true });
  } catch (error) {
    console.error("Delete attribute error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Attribute");
    }

    return createErrorResponse(error, "Failed to delete attribute");
  }
}
