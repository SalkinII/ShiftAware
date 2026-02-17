import { NextRequest } from "next/server";
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { z } from "zod";
import { eventConfigSchema } from "@/lib/validations/event-config";
import { EventsService } from "@/lib/services/events.service";
import { RepositoryError } from "@/lib/repositories/base.repository";

const service = new EventsService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { id } = await params;

    const config = await service.getConfig(id);

    if (!config) {
      // Return default config structure if none exists
      const event = await service.getEvent(id);

      return createSuccessResponse({
        event,
        config: null,
        defaults: {
          minShiftsPerPerson: 2,
          bufferDaysBefore: 1,
          bufferDaysAfter: 1,
          algorithmWeights: {},
          balanceThresholds: {},
          autoAssignUnfilled: true,
        },
      });
    }

    return createSuccessResponse(config);
  } catch (error) {
    console.error("Get event config error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }

    return createErrorResponse(error, "Failed to fetch event config");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const admin = await isAdmin();
    if (!admin) {
      return createErrorResponse(
        new Error("Forbidden"),
        "Admin access required",
        403,
      );
    }

    const { id } = await params;
    const body = await request.json();
    const validated = eventConfigSchema.parse(body);

    const config = await service.upsertConfig(id, {
      minShiftsPerPerson: validated.minShiftsPerPerson,
      bufferDaysBefore: validated.bufferDaysBefore,
      bufferDaysAfter: validated.bufferDaysAfter,
      algorithmWeights: validated.algorithmWeights || {},
      balanceThresholds: validated.balanceThresholds || {},
      autoAssignUnfilled: validated.autoAssignUnfilled,
    });

    try {
      await createAuditLog({
        action: AuditAction.UPDATE,
        entityType: EntityType.CONFIG,
        entityId: id,
        after: validated,
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });
    } catch (auditError) {
      console.error("Audit log failed:", auditError);
    }

    return createSuccessResponse(config);
  } catch (error) {
    console.error("Update event config error:", error);

    if (error instanceof z.ZodError) {
      return createErrorResponse(error, "Validation failed", 400);
    }

    if (error instanceof RepositoryError) {
      return createErrorResponse(error, error.message);
    }

    return createErrorResponse(error, "Failed to update event config");
  }
}
