import { isAuthenticated } from "@/lib/auth";
import { createAuditLog } from "@/lib/services/audit";
import { preferenceSchema } from "@/lib/validations/preference";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { PreferencesService } from "@/lib/services/preferences.service";
import { StatusGuardError } from "@/lib/services/event-status-guard";
import { RepositoryError } from "@/lib/repositories/base.repository";

const service = new PreferencesService();

export async function GET(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const teamMemberId = searchParams.get("teamMemberId") || undefined;
    const shiftId = searchParams.get("shiftId") || undefined;

    const preferences = await service.listPreferencesWithDetails({
      teamMemberId,
      shiftId,
    });
    return createSuccessResponse(preferences);
  } catch (error) {
    console.error("Get preferences error:", error);
    return createErrorResponse(error, "Failed to fetch preferences");
  }
}

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

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
  } catch (error) {
    if (error instanceof StatusGuardError) {
      return createErrorResponse(error, error.message, 403);
    }
    if (error instanceof RepositoryError) {
      if (error.code === "NOT_FOUND") {
        return createNotFoundResponse("Team member or shift");
      }
    }
    console.error("Create preference error:", error);
    return createErrorResponse(error, "Failed to save preference");
  }
}

export async function DELETE(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

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
  } catch (error) {
    if (error instanceof StatusGuardError) {
      return createErrorResponse(error, error.message, 403);
    }
    if (error instanceof RepositoryError) {
      if (error.code === "NOT_FOUND") {
        return createNotFoundResponse("Preference");
      }
    }
    console.error("Delete preference error:", error);
    return createErrorResponse(error, "Failed to delete preference");
  }
}
