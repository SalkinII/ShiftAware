import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { shiftSchema } from "@/lib/validations/shift";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import {
  createSuccessResponse,
} from "@/lib/api-errors";
import { ShiftsService } from "@/lib/services/shifts.service";
const service = new ShiftsService();

export const GET = withAuth(withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: Prisma.ShiftWhereInput = {};

  if (eventId) {
    where.eventId = eventId;
  }

  if (startDate || endDate) {
    where.startTime = {};
    if (startDate) {
      where.startTime.gte = new Date(startDate);
    }
    if (endDate) {
      where.startTime.lte = new Date(endDate);
    }
  }

  const shifts =
    Object.keys(where).length > 0
      ? await service.listShiftsWithDetails(where)
      : await service.listShiftsWithDetails();

  return createSuccessResponse(shifts);
}));

export const POST = withAuth(withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const validated = shiftSchema.parse(body);

  // Create shift with required roles
  const { requiredRoles, eventId, templateId, ...shiftData } = validated;

  const shift = await service.createShift({
    ...shiftData,
    startTime: new Date(validated.startTime),
    endTime: new Date(validated.endTime),
    event: { connect: { id: eventId } },
    ...(templateId ? { template: { connect: { id: templateId } } } : {}),
    requiredRoles: {
      create: requiredRoles,
    },
  });

  await createAuditLog({
    action: AuditAction.CREATE,
    entityType: EntityType.SHIFT,
    entityId: shift.id,
    after: shift,
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
  });

  return createSuccessResponse(shift, 201);
}));
