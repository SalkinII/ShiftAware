import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import {
  createSuccessResponse,
} from "@/lib/api-errors";
import { shiftTemplateCreateSchema } from "@/lib/validations/template";
import { createAuditLog } from "@/lib/utils/audit";
import { AuditAction, EntityType } from "@prisma/client";
import { ShiftTemplateRepository } from "@/lib/repositories/shift-template.repository";

const templateRepo = new ShiftTemplateRepository();

export const GET = withAuth(withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const environmentId = searchParams.get("environmentId") || undefined;
  const includeGlobal = searchParams.get("includeGlobal") !== "false";
  const festivalId = searchParams.get("festivalId");

  const templates = environmentId
    ? await templateRepo.findForEvent(environmentId, includeGlobal !== false)
    : await templateRepo.findGlobal(festivalId);

  return createSuccessResponse(templates);
}));

export const POST = withAuth(withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const validated = shiftTemplateCreateSchema.parse(body);

  const { requiredRoles, festivalId, ...templateData } = validated;

  const template = await templateRepo.create({
    ...templateData,
    ...(festivalId ? { festival: { connect: { id: festivalId } } } : {}),
    requiredRoles: {
      create: requiredRoles,
    },
  });

  await createAuditLog({
    action: AuditAction.CREATE,
    entityType: EntityType.CONFIG,
    entityId: template.id,
    after: template,
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
  });

  return createSuccessResponse(template, 201);
}));
