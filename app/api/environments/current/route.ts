import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import {
  createSuccessResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { EnvironmentRepository } from "@/lib/repositories/environment.repository";

const environmentRepo = new EnvironmentRepository();

export const GET = withAuth(withErrorHandling(async () => {
  const event = await environmentRepo.findCurrent();

  if (!event) {
    return createNotFoundResponse("Event");
  }

  return createSuccessResponse(event);
}));
