import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { isAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/utils/audit";
import {
  createErrorResponse,
  createForbiddenResponse,
  createNotFoundResponse,
  createSuccessResponse,
} from "@/lib/api-errors";
import { updateFestivalSchema } from "@/lib/validations/festival";
import { FestivalRepository } from "@/lib/repositories/festival.repository";

export const PUT = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {
  if (!(await isAdmin())) {
    return createForbiddenResponse("Only admins can manage festivals");
  }

  const { id } = await params;

  const festivalRepo = new FestivalRepository();
  const before = await festivalRepo.findById(id);
  if (!before) return createNotFoundResponse("Festival");

  const body = await request.json();
  const validation = updateFestivalSchema.safeParse(body);

  if (!validation.success) {
    return createErrorResponse(
      new Error(validation.error.errors[0].message),
      validation.error.errors[0].message,
      400,
    );
  }

  const { name, startDate, endDate } = validation.data;

  const after = await festivalRepo.update(id, {
    ...(name !== undefined && { name }),
    ...(startDate !== undefined && { startDate: new Date(startDate) }),
    ...(endDate !== undefined && { endDate: new Date(endDate) }),
  });

  await createAuditLog({
    action: "UPDATE",
    entityType: "FESTIVAL",
    entityId: id,
    before,
    after,
  });

  return createSuccessResponse(after);
}));
