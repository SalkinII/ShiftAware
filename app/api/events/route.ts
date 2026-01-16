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
