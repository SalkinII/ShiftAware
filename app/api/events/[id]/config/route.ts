import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
} from "@/lib/api-errors";
import { z } from "zod";
import { eventConfigSchema } from "@/lib/validations/event-config";
import { EventsService } from "@/lib/services/events.service";
const service = new EventsService();

export const GET = withAuth(withErrorHandling(async (request: NextRequest,
  { params }: { params: Promise<{ id: string }> },) => {
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
        algorithmWeights: {},
        balanceThresholds: {},
        autoAssignUnfilled: true,
      },
    });
  }

  return createSuccessResponse(config);
}));

export const PUT = withAuth(withErrorHandling(async (request: NextRequest,
  { params }: { params: Promise<{ id: string }> },) => {
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
    algorithmWeights: validated.algorithmWeights || {},
    balanceThresholds: validated.balanceThresholds || {},
    autoAssignUnfilled: validated.autoAssignUnfilled,
    allocationRules: validated.allocationRules,
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
}));
