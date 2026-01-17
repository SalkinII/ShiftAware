import { NextRequest } from "next/server";
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
} from "@/lib/api-errors";
import { z } from "zod";

const eventConfigSchema = z.object({
  minShiftsPerPerson: z.number().int().min(0).default(2),
  bufferDaysBefore: z.number().int().min(0).max(14).default(1),
  bufferDaysAfter: z.number().int().min(0).max(14).default(1),
  algorithmWeights: z.record(z.number()).optional(),
  balanceThresholds: z.record(z.number()).optional(),
  autoAssignUnfilled: z.boolean().default(true),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { id } = await params;

    const config = await prisma.eventConfig.findUnique({
      where: { eventId: id },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
      },
    });

    if (!config) {
      // Return default config structure if none exists
      const event = await prisma.event.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          status: true,
        },
      });

      if (!event) {
        return createErrorResponse(new Error("Event not found"), "Event not found", 404);
      }

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
    return createErrorResponse(error, "Failed to fetch event config");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const admin = await isAdmin();
    if (!admin) {
      return createErrorResponse(new Error("Forbidden"), "Admin access required", 403);
    }

    const { id } = await params;
    const body = await request.json();
    const validated = eventConfigSchema.parse(body);

    // Upsert: create if doesn't exist, update if it does
    const config = await prisma.eventConfig.upsert({
      where: { eventId: id },
      update: {
        minShiftsPerPerson: validated.minShiftsPerPerson,
        bufferDaysBefore: validated.bufferDaysBefore,
        bufferDaysAfter: validated.bufferDaysAfter,
        algorithmWeights: validated.algorithmWeights || {},
        balanceThresholds: validated.balanceThresholds || {},
        autoAssignUnfilled: validated.autoAssignUnfilled,
      },
      create: {
        eventId: id,
        minShiftsPerPerson: validated.minShiftsPerPerson,
        bufferDaysBefore: validated.bufferDaysBefore,
        bufferDaysAfter: validated.bufferDaysAfter,
        algorithmWeights: validated.algorithmWeights || {},
        balanceThresholds: validated.balanceThresholds || {},
        autoAssignUnfilled: validated.autoAssignUnfilled,
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
      },
    });

    return createSuccessResponse(config);
  } catch (error) {
    console.error("Update event config error:", error);
    if (error instanceof z.ZodError) {
      return createErrorResponse(error, "Validation failed", 400);
    }
    return createErrorResponse(error, "Failed to update event config");
  }
}
