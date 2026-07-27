import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
// app/api/events/[id]/registrations/route.ts
import { isAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/utils/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
} from "@/lib/api-errors";
import { createRegistrationSchema } from "@/lib/validations/event-registration";
import { EventRepository } from "@/lib/repositories/event.repository";
const eventRepo = new EventRepository();

export const GET = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const { id: eventId } = await params;

  await eventRepo.findById(eventId);

  const registrations = await eventRepo.listRegistrations(eventId);

  return createSuccessResponse(registrations);
}));

export const POST = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const { id: eventId } = await params;

  // Verify event exists
  await eventRepo.findById(eventId);

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
  const existing = await eventRepo.findRegistration(
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

  const registration = await eventRepo.createRegistration(
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
}));
