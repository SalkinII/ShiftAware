import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { createAuditLog } from "@/lib/services/audit";
import { preferenceSchema } from "@/lib/validations/preference";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
} from "@/lib/api-errors";
import { PreferencesService } from "@/lib/services/preferences.service";
const service = new PreferencesService();

export const GET = withAuth(withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const teamMemberId = searchParams.get("teamMemberId") || undefined;
  const shiftId = searchParams.get("shiftId") || undefined;

  const preferences = await service.listPreferencesWithDetails({
    teamMemberId,
    shiftId,
  });
  return createSuccessResponse(preferences);
}));

export const POST = withAuth(withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const validated = preferenceSchema.parse(body);

  const preference = await service.upsertPreference({
    teamMemberId: validated.teamMemberId,
    shiftId: validated.shiftId,
    wantLevel: validated.wantLevel,
    notes: validated.notes,
  });

  try {
    await createAuditLog({
      action: AuditAction.PREFERENCE_SUBMIT,
      entityType: EntityType.PREFERENCE,
      entityId: preference.id,
      after: {
        shiftId: validated.shiftId,
        wantLevel: validated.wantLevel,
      },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });
  } catch (auditError) {
    console.error("Audit log failed:", auditError);
  }

  return createSuccessResponse(preference);
}));

export const DELETE = withAuth(withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const teamMemberId = searchParams.get("teamMemberId");
  const shiftId = searchParams.get("shiftId");

  if (!teamMemberId || !shiftId) {
    return createErrorResponse(
      null,
      "teamMemberId and shiftId required",
      400,
    );
  }

  await service.deleteByCompoundKey(teamMemberId, shiftId);

  try {
    await createAuditLog({
      action: AuditAction.DELETE,
      entityType: EntityType.PREFERENCE,
      entityId: `${teamMemberId}-${shiftId}`,
      before: { teamMemberId, shiftId },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });
  } catch (auditError) {
    console.error("Audit log failed:", auditError);
  }

  return createSuccessResponse({ deleted: true });
}));
