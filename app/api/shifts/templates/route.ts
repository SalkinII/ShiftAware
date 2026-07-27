import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import {
  createSuccessResponse,
} from "@/lib/api-errors";
import { shiftTemplateSchema } from "@/lib/validations/template";
import { createAuditLog } from "@/lib/utils/audit";
import { AuditAction, EntityType } from "@prisma/client";
import { ShiftTemplateRepository } from "@/lib/repositories/shift-template.repository";

const templateRepo = new ShiftTemplateRepository();

export const GET = withAuth(withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId") || undefined;
  const includeGlobal = searchParams.get("includeGlobal") !== "false";

  const templates = eventId
    ? await templateRepo.findForEvent(eventId, includeGlobal !== false)
    : await templateRepo.findGlobal();

  return createSuccessResponse(templates);
}));

export const POST = withAuth(withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const validated = shiftTemplateSchema.parse(body);

  const { requiredRoles, eventId, ...templateData } = validated;

  const template = await templateRepo.create({
    ...templateData,
    ...(eventId ? { event: { connect: { id: eventId } } } : {}),
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
