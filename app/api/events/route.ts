import { isAuthenticated, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { createEventSchema } from "@/lib/validations/event";
import { EventsService } from "@/lib/services/events.service";

export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const service = new EventsService();
    const events = await service.listEventsWithStats();

    return createSuccessResponse(events);
  } catch (error) {
    console.error("Get events error:", error);
    return createErrorResponse(error, "Failed to fetch events");
  }
}

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

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

    const { name, startDate, endDate, bufferDaysBefore, bufferDaysAfter } =
      validation.data;

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
        bufferDaysBefore,
        bufferDaysAfter,
        algorithmWeights: {
          preferenceMatch: 0.35,
          experienceBalance: 0.25,
          workloadFairness: 0.15,
          coreShiftCoverage: 0.05,
        },
        balanceThresholds: {
          minGenderBalance: 0.3,
          minExperienceMix: true,
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
  } catch (error) {
    console.error("Create event error:", error);
    return createErrorResponse(error, "Failed to create event");
  }
}
