import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { markerSchema } from "@/lib/validations/marker";
import { createSuccessResponse } from "@/lib/api-errors";
import { MarkerRepository } from "@/lib/repositories/marker.repository";
import { assertEventStatusAllows } from "@/lib/domain/event-status";

const markerRepo = new MarkerRepository();

export const GET = withAuth(withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) return createSuccessResponse([]);
  const markers = await markerRepo.findByEvent(eventId);
  return createSuccessResponse(markers);
}));

export const POST = withAuth(withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const validated = markerSchema.parse(body);

  await assertEventStatusAllows(validated.eventId, "SHIFT_MUTATE");

  const marker = await markerRepo.create({
    eventId: validated.eventId,
    text: validated.text,
    startTime: new Date(validated.startTime),
    endTime: new Date(validated.endTime),
  });

  return createSuccessResponse(marker, 201);
}));
