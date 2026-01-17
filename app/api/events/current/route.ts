import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
} from "@/lib/api-errors";

export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    // Get the most recent event that's not completed
    // If all are completed, get the most recent one
    const event = await prisma.event.findFirst({
      where: {
        status: {
          not: "COMPLETED",
        },
      },
      include: {
        config: true,
        _count: {
          select: {
            shifts: true,
          },
        },
      },
      orderBy: { startDate: "asc" },
    });

    if (event) {
      return createSuccessResponse(event);
    }

    // Fallback to most recent event
    const fallbackEvent = await prisma.event.findFirst({
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

    if (!fallbackEvent) {
      return createErrorResponse(new Error("No events found"), "No events found", 404);
    }

    return createSuccessResponse(fallbackEvent);
  } catch (error) {
    console.error("Get current event error:", error);
    return createErrorResponse(error, "Failed to fetch current event");
  }
}
