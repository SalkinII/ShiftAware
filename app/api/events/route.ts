import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { createEventSchema } from "@/lib/validations/event";
import { EventsService } from "@/lib/services/events.service";

export const GET = withAuth(withErrorHandling(async () => {
  const service = new EventsService();
  const events = await service.listEventsWithStats();

  return createSuccessResponse(events);
}));

export const POST = withAuth(withErrorHandling(async (request: Request) => {
  const admin = await isAdmin();
  if (!admin) {
    return createForbiddenResponse("Only admins can create events");
  }

  const body = await request.json();
  const validation = createEventSchema.safeParse(body);

  if (!validation.success) {
    return createErrorResponse(
      new Error(validation.error.errors[0].message),
      validation.error.errors[0].message,
      400,
    );
  }

  const { name, startDate, endDate } = validation.data;

  const service = new EventsService();

  // Create event with config
  const event = await service.createEventWithConfig(
    {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: "PLANNING",
    },
    {
      minShiftsPerPerson: 2,
      algorithmWeights: {
        preferenceMatch: 0.7,
        workloadFairness: 0.3,
      },
      balanceThresholds: {
        minGenderBalance: 0.3,
        minExperienceMix: 1,
        maxConsecutiveShifts: 3,
      },
      autoAssignUnfilled: true,
    },
  );

  // Log the action
  await prisma.auditLog.create({
    data: {
      action: "CREATE",
      entityType: "EVENT",
      entityId: event.id,
      after: { name, startDate, endDate },
    },
  });

  // Fetch the complete event with config and count
  const fullEvent = await prisma.event.findUnique({
    where: { id: event.id },
    include: {
      config: true,
      _count: { select: { shifts: true } },
    },
  });

  return createSuccessResponse(fullEvent, 201);
}));
