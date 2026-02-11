import { isAuthenticated, isAdmin } from "@/lib/auth";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { attributeDefinitionSchema } from "@/lib/validations/attribute";
import { EventsService } from "@/lib/services/events.service";
import { RepositoryError } from "@/lib/repositories/base.repository";

const service = new EventsService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { id: eventId } = await params;

    await service.getEvent(eventId);

    const attributes = await service.listEventAttributes(eventId);

    return createSuccessResponse(attributes);
  } catch (error) {
    console.error("Get event attributes error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }

    return createErrorResponse(error, "Failed to fetch event attributes");
  }
}

export async function POST(
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
  } catch (error) {
    console.error("Create attribute error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }

    return createErrorResponse(error, "Failed to create attribute");
  }
}
