import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/db";
import {
  createSuccessResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import { setHours, setMinutes, addMinutes } from "date-fns";

export const POST = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ scheduledId: string }> },) => {
  const { scheduledId } = await params;

  // Get scheduled shift with template
  const scheduledShift = await prisma.scheduledShift.findUnique({
    where: { id: scheduledId },
    include: {
      template: {
        include: {
          requiredRoles: true,
        },
      },
      event: true,
    },
  });

  if (!scheduledShift) {
    return createNotFoundResponse("Scheduled shift");
  }

  if (scheduledShift.shiftId) {
    // Already converted
    const existingShift = await prisma.shift.findUnique({
      where: { id: scheduledShift.shiftId },
      include: { requiredRoles: true },
    });
    return createSuccessResponse(existingShift);
  }

  // Calculate startTime and endTime from template + date
  const date = scheduledShift.date;
  const [hours, minutes] = scheduledShift.template.startTime
    .split(":")
    .map(Number);
  const startTime = setMinutes(setHours(date, hours), minutes);
  const endTime = addMinutes(
    startTime,
    scheduledShift.template.durationMinutes,
  );

  // Create actual shift
  const shift = await prisma.shift.create({
    data: {
      eventId: scheduledShift.eventId,
      type: scheduledShift.template.type,
      startTime,
      endTime,
      durationMinutes: scheduledShift.template.durationMinutes,
      priority: scheduledShift.template.priority,
      desirabilityScore: scheduledShift.template.desirabilityScore,
      capacity: scheduledShift.template.capacity,
      requiredRoles: {
        create: scheduledShift.template.requiredRoles.map((tr) => ({
          role: tr.role,
          count: tr.count,
        })),
      },
    },
    include: {
      requiredRoles: true,
      event: true,
    },
  });

  // Link scheduled shift to created shift
  await prisma.scheduledShift.update({
    where: { id: scheduledId },
    data: { shiftId: shift.id },
  });

  await createAuditLog({
    action: AuditAction.CREATE,
    entityType: EntityType.SHIFT,
    entityId: shift.id,
    after: shift,
    reason: `Created from template: ${scheduledShift.template.name}`,
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
  });

  return createSuccessResponse(shift, 201);
}));
