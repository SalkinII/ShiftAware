import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import {
  createSuccessResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { EventRepository } from "@/lib/repositories/event.repository";

const eventRepo = new EventRepository();

export const GET = withAuth(withErrorHandling(async () => {
  const event = await eventRepo.findCurrent();

  if (!event) {
    return createNotFoundResponse("Event");
  }

  return createSuccessResponse(event);
}));
