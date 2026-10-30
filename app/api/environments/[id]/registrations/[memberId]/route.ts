import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
// app/api/environments/[id]/registrations/[memberId]/route.ts
import { isAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/utils/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createSuccessResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { updateRegistrationSchema } from "@/lib/validations/event-registration";
import { EnvironmentRegistrationRepository } from "@/lib/repositories/environment-registration.repository";
const registrationRepo = new EnvironmentRegistrationRepository();

export const GET = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },) => {

  const { id: environmentId, memberId } = await params;

  const registration = await registrationRepo.getRegistration(environmentId, memberId);

  if (!registration) return createNotFoundResponse("Registration");

  return createSuccessResponse(registration);
}));

export const PUT = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },) => {

  const admin = await isAdmin();
  if (!admin) return createForbiddenResponse("Admin access required");

  const { id: environmentId, memberId } = await params;

  const body = await request.json();
  const validated = updateRegistrationSchema.parse(body);

  const updated = await registrationRepo.updateRegistration(
    environmentId,
    memberId,
    validated,
  );

  return createSuccessResponse(updated);
}));

export const DELETE = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },) => {

  const admin = await isAdmin();
  if (!admin) return createForbiddenResponse("Admin access required");

  const { id: environmentId, memberId } = await params;

  await registrationRepo.deleteRegistrationWithCleanup(environmentId, memberId);

  try {
    await createAuditLog({
      action: AuditAction.DELETE,
      entityType: EntityType.TEAM_MEMBER,
      entityId: `${environmentId}-${memberId}`,
      before: { environmentId, memberId },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });
  } catch (auditError) {
    console.error("Audit log failed:", auditError);
  }

  return createSuccessResponse({ deleted: true });
}));
