// app/api/events/[id]/registrations/[memberId]/route.ts
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
import { updateRegistrationSchema } from "@/lib/validations/event-registration";
import { EventsService } from "@/lib/services/events.service";
import { RepositoryError } from "@/lib/repositories/base.repository";

const service = new EventsService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id: eventId, memberId } = await params;

    const registration = await service.getRegistration(eventId, memberId);

    if (!registration) return createNotFoundResponse("Registration");

    return createSuccessResponse(registration);
  } catch (error) {
    console.error("Get registration error:", error);
    return createErrorResponse(error, "Failed to fetch registration");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId, memberId } = await params;

    const body = await request.json();
    const validated = updateRegistrationSchema.parse(body);

    const updated = await service.updateRegistration(
      eventId,
      memberId,
      validated,
    );

    return createSuccessResponse(updated);
  } catch (error) {
    console.error("Update registration error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Registration");
    }

    return createErrorResponse(error, "Failed to update registration");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId, memberId } = await params;

    await service.deleteRegistration(eventId, memberId);

    try {
      await createAuditLog({
        action: AuditAction.DELETE,
        entityType: EntityType.TEAM_MEMBER,
        entityId: `${eventId}-${memberId}`,
        before: { eventId, memberId },
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });
    } catch (auditError) {
      console.error("Audit log failed:", auditError);
    }

    return createSuccessResponse({ deleted: true });
  } catch (error) {
    console.error("Delete registration error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Registration");
    }

    return createErrorResponse(error, "Failed to remove registration");
  }
}
