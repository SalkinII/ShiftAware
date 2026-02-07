import { isAuthenticated } from "@/lib/auth";
import { preferenceSchema } from "@/lib/validations/preference";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { PreferencesService } from "@/lib/services/preferences.service";
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

    const preferences = await service.listPreferencesWithDetails({ teamMemberId, shiftId });
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

    return createSuccessResponse(preference);
  } catch (error) {
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

    return createSuccessResponse({ deleted: true });
  } catch (error) {
    if (error instanceof RepositoryError) {
      if (error.code === "NOT_FOUND") {
        return createNotFoundResponse("Preference");
      }
    }
    console.error("Delete preference error:", error);
    return createErrorResponse(error, "Failed to delete preference");
  }
}
