import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/db";
import { updateShiftSchema } from "@/lib/validations/shift";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createSuccessResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { ShiftsService } from "@/lib/services/shifts.service";
const service = new ShiftsService();

export const GET = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {
  const { id } = await params;
  const shift = await service.getShiftWithDetails(id);
  return createSuccessResponse(shift);
}));

export const PUT = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {
  const { id: shiftId } = await params;
  const body = await request.json();
  const validated = updateShiftSchema.parse({ ...body, id: shiftId });

  const existing = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { requiredRoles: true },
  });

  if (!existing) {
    return createNotFoundResponse("Shift");
  }

  const { id, requiredRoles, ...updateData } = validated;
  const before = { ...existing };

  // Prepare shift data with date conversions
  const shiftData = {
    ...updateData,
    startTime: updateData.startTime
      ? new Date(updateData.startTime)
      : undefined,
    endTime: updateData.endTime ? new Date(updateData.endTime) : undefined,
  };

  const shift = await service.updateShiftWithRoles(
    id,
    shiftData,
    requiredRoles,
  );

  await createAuditLog({
    action: AuditAction.UPDATE,
    entityType: EntityType.SHIFT,
    entityId: shift.id,
    before,
    after: shift,
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
  });

  return createSuccessResponse(shift);
}));

export const DELETE = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {
  const { id: shiftId } = await params;
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { requiredRoles: true },
  });

  if (!shift) {
    return createNotFoundResponse("Shift");
  }

  await service.cascadeDeleteShift(shiftId);

  await createAuditLog({
    action: AuditAction.DELETE,
    entityType: EntityType.SHIFT,
    entityId: shift.id,
    before: shift,
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
  });

  return createSuccessResponse({ success: true });
}));
