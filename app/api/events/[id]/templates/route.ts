// app/api/events/[id]/templates/route.ts
import { isAuthenticated, isAdmin } from "@/lib/auth";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { assignTemplateSchema } from "@/lib/validations/event-template";
import { EventsService } from "@/lib/services/events.service";
import { RepositoryError } from "@/lib/repositories/base.repository";

const service = new EventsService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id: eventId } = await params;

    await service.getEvent(eventId);

    const templates = await service.listEventTemplates(eventId);

    return createSuccessResponse(templates);
  } catch (error) {
    console.error("Get event templates error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }

    return createErrorResponse(error, "Failed to fetch templates");
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
    const validated = assignTemplateSchema.parse(body);

    // Check not already assigned
    const existing = await service.findEventTemplate(
      eventId,
      validated.templateId,
    );
    if (existing) {
      return createErrorResponse(
        null,
        "Template already assigned to this event",
        409,
      );
    }

    const assignment = await service.assignTemplate(
      eventId,
      validated.templateId,
    );

    return createSuccessResponse(assignment, 201);
  } catch (error) {
    console.error("Assign template error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }

    return createErrorResponse(error, "Failed to assign template");
  }
}
