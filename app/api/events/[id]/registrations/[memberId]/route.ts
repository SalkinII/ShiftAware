import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
// app/api/events/[id]/registrations/[memberId]/route.ts
import { isAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/utils/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createSuccessResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { updateRegistrationSchema } from "@/lib/validations/event-registration";
import { EventRegistrationRepository } from "@/lib/repositories/event-registration.repository";
const registrationRepo = new EventRegistrationRepository();

export const GET = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },) => {

  const { id: eventId, memberId } = await params;

  const registration = await registrationRepo.getRegistration(eventId, memberId);

  if (!registration) return createNotFoundResponse("Registration");

  return createSuccessResponse(registration);
}));

export const PUT = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },) => {

  const admin = await isAdmin();
  if (!admin) return createForbiddenResponse("Admin access required");

  const { id: eventId, memberId } = await params;

  const body = await request.json();
  const validated = updateRegistrationSchema.parse(body);

  const updated = await registrationRepo.updateRegistration(
    eventId,
    memberId,
    validated,
  );

  return createSuccessResponse(updated);
}));

export const DELETE = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },) => {

  const admin = await isAdmin();
  if (!admin) return createForbiddenResponse("Admin access required");

  const { id: eventId, memberId } = await params;

  await registrationRepo.deleteRegistrationWithCleanup(eventId, memberId);

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
}));
