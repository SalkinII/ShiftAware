import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { updateMarkerSchema } from "@/lib/validations/marker";
import { createSuccessResponse } from "@/lib/api-errors";
import { MarkerRepository } from "@/lib/repositories/marker.repository";
import { assertEventStatusAllows } from "@/lib/domain/event-status";

const markerRepo = new MarkerRepository();

export const PATCH = withAuth(withErrorHandling(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const body = await request.json();
  const validated = updateMarkerSchema.parse({ ...body, id });

  const existing = await markerRepo.findById(id);
  await assertEventStatusAllows(existing.eventId, "SHIFT_MUTATE");

  const { id: _id, ...updateData } = validated;
  const marker = await markerRepo.update(id, {
    ...updateData,
    startTime: updateData.startTime ? new Date(updateData.startTime) : undefined,
    endTime: updateData.endTime ? new Date(updateData.endTime) : undefined,
  });

  return createSuccessResponse(marker);
}));

export const DELETE = withAuth(withErrorHandling(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const existing = await markerRepo.findById(id);
  await assertEventStatusAllows(existing.eventId, "SHIFT_MUTATE");
  await markerRepo.delete(id);
  return createSuccessResponse({ success: true });
}));
