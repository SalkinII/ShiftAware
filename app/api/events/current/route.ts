import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import {
  createSuccessResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { EventsService } from "@/lib/services/events.service";

const service = new EventsService();

export const GET = withAuth(withErrorHandling(async () => {
  const event = await service.getCurrentEvent();

  if (!event) {
    return createNotFoundResponse("Event");
  }

  return createSuccessResponse(event);
}));
