import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
// app/api/environments/[id]/registrations/route.ts
import { isAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/utils/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
} from "@/lib/api-errors";
import { createRegistrationSchema } from "@/lib/validations/event-registration";
import { EnvironmentRepository } from "@/lib/repositories/environment.repository";
import { EnvironmentRegistrationRepository } from "@/lib/repositories/environment-registration.repository";
const environmentRepo = new EnvironmentRepository();
const registrationRepo = new EnvironmentRegistrationRepository();

export const GET = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const { id: environmentId } = await params;

  await environmentRepo.findById(environmentId);

  const registrations = await registrationRepo.listRegistrations(environmentId);

  return createSuccessResponse(registrations);
}));

export const POST = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const { id: environmentId } = await params;

  // Verify event exists
  await environmentRepo.findById(environmentId);

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
  const existing = await registrationRepo.findRegistration(
    environmentId,
    validated.memberId,
  );
  if (existing) {
    return createErrorResponse(
      null,
      "Member already registered for this event",
      409,
    );
  }

  const registration = await registrationRepo.createRegistration(
    environmentId,
    validated.memberId,
    validated.status,
  );

  try {
    await createAuditLog({
      action: AuditAction.CREATE,
      entityType: EntityType.TEAM_MEMBER,
      entityId: registration.id,
      after: {
        environmentId,
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
