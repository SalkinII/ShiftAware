import { isAuthenticated, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { z } from "zod";

// Validation schema for creating an event
const createEventSchema = z
  .object({
    name: z.string().min(1, "Event name is required").max(100),
    startDate: z
      .string()
      .refine((d) => !isNaN(Date.parse(d)), "Invalid start date"),
    endDate: z
      .string()
      .refine((d) => !isNaN(Date.parse(d)), "Invalid end date"),
    bufferDaysBefore: z.number().int().min(0).max(30).default(1),
    bufferDaysAfter: z.number().int().min(0).max(30).default(1),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const events = await prisma.event.findMany({
      include: {
        config: true,
        _count: {
          select: {
            shifts: true,
          },
        },
      },
      orderBy: { startDate: "desc" },
    });

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

    // Create event with config in a transaction
    const event = await prisma.$transaction(async (tx) => {
      const newEvent = await tx.event.create({
        data: {
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status: "PLANNING",
        },
      });

      await tx.eventConfig.create({
        data: {
          eventId: newEvent.id,
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
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entityType: "Event",
          entityId: newEvent.id,
          details: { name, startDate, endDate },
        },
      });

      return newEvent;
    });

    // Fetch the complete event with config
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
