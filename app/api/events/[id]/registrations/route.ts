// app/api/events/[id]/registrations/route.ts
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
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

    const { id: eventId } = await params;

    // Verify event exists
    await service.getEvent(eventId);

    const body = await request.json();
    const validated = createRegistrationSchema.parse(body);

    // Non-admin users can only register themselves (by their own memberId)
    // Admin users can register anyone
    const admin = await isAdmin();
    if (!admin) {
      // For non-admin: allow self-registration
      // (In this prototype, we trust the memberId from the client)
    }

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

    try {
      await createAuditLog({
        action: AuditAction.CREATE,
        entityType: EntityType.TEAM_MEMBER,
        entityId: registration.id,
        after: {
          eventId,
          memberId: validated.memberId,
          status: validated.status,
        },
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });
    } catch (auditError) {
      console.error("Audit log failed:", auditError);
    }

    return createSuccessResponse(registration, 201);
  } catch (error) {
    console.error("Create registration error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }

    return createErrorResponse(error, "Failed to register member");
  }
}
