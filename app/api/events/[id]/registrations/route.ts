// app/api/events/[id]/registrations/route.ts
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { createRegistrationSchema } from "@/lib/validations/event-registration";
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

    const registrations = await service.listRegistrations(eventId);

    return createSuccessResponse(registrations);
  } catch (error) {
    console.error("Get event registrations error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }

    return createErrorResponse(error, "Failed to fetch registrations");
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
    const validated = createRegistrationSchema.parse(body);

    // Check member exists
    const member = await prisma.teamMember.findUnique({
      where: { id: validated.memberId },
    });
    if (!member) return createNotFoundResponse("Member not found");

    // Check not already registered
    const existing = await service.findRegistration(
      eventId,
      validated.memberId,
    );
    if (existing) {
      return createErrorResponse(
        null,
        "Member already registered for this event",
        409,
      );
    }

    const registration = await service.createRegistration(
      eventId,
      validated.memberId,
      validated.status,
    );

    return createSuccessResponse(registration, 201);
  } catch (error) {
    console.error("Create registration error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }

    return createErrorResponse(error, "Failed to register member");
  }
}
