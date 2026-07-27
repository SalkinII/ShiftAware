import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import {
  createSuccessResponse,
} from "@/lib/api-errors";
import { shiftTemplateSchema } from "@/lib/validations/template";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import { ShiftTemplatesService } from "@/lib/services/shift-templates.service";
const service = new ShiftTemplatesService();

export const GET = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {
  const { id } = await params;
  const template = await service.getTemplate(id);

  return createSuccessResponse(template);
}));

export const PUT = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {
  const { id } = await params;
  const body = await request.json();
  const validated = shiftTemplateSchema.parse(body);

  const { requiredRoles, ...templateData } = validated;

  // Get existing template for audit
  const existing = await service.getTemplate(id);

  // Update template and roles
  const template = await service.updateTemplate(
    id,
    templateData,
    requiredRoles,
  );

  await createAuditLog({
    action: AuditAction.UPDATE,
    entityType: EntityType.CONFIG,
    entityId: template.id,
    before: existing,
    after: template,
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
  });

  return createSuccessResponse(template);
}));

export const DELETE = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {
  const { id } = await params;

  const existing = await service.getTemplate(id);

  await service.deleteTemplate(id);

  await createAuditLog({
    action: AuditAction.DELETE,
    entityType: EntityType.CONFIG,
    entityId: id,
    before: existing,
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
  });

  return createSuccessResponse({ id }, 200);
}));
