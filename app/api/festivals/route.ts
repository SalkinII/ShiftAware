import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { isAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/utils/audit";
import {
  createErrorResponse,
  createSuccessResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { createFestivalSchema } from "@/lib/validations/festival";
import { FestivalRepository } from "@/lib/repositories/festival.repository";

export const GET = withAuth(withErrorHandling(async () => {
  const festivalRepo = new FestivalRepository();
  const festivals = await festivalRepo.findAll();

  return createSuccessResponse(festivals);
}));

export const POST = withAuth(withErrorHandling(async (request: Request) => {
  if (!(await isAdmin())) {
    return createForbiddenResponse("Only admins can manage festivals");
  }

  const body = await request.json();
  const validation = createFestivalSchema.safeParse(body);

  if (!validation.success) {
    return createErrorResponse(
      new Error(validation.error.errors[0].message),
      validation.error.errors[0].message,
      400,
    );
  }

  const { name, startDate, endDate } = validation.data;

  const festivalRepo = new FestivalRepository();
  const festival = await festivalRepo.create({
    name,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });

  await createAuditLog({
    action: "CREATE",
    entityType: "FESTIVAL",
    entityId: festival.id,
    after: festival,
  });

  return createSuccessResponse(festival, 201);
}));
