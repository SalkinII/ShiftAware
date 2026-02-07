import { isAuthenticated } from "@/lib/auth";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { EventsService } from "@/lib/services/events.service";

const service = new EventsService();

export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const event = await service.getCurrentEvent();

    if (!event) {
      return createNotFoundResponse("Event");
    }

    return createSuccessResponse(event);
  } catch (error) {
    console.error("Get current event error:", error);
    return createErrorResponse(error, "Failed to fetch current event");
  }
}
