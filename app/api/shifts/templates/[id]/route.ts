import { isAuthenticated } from "@/lib/auth";
import {
  createUnauthorizedResponse,
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { shiftTemplateSchema } from "@/lib/validations/template";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import { ShiftTemplatesService } from "@/lib/services/shift-templates.service";
import { RepositoryError } from "@/lib/repositories/base.repository";

const service = new ShiftTemplatesService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { id } = await params;
    const template = await service.getTemplate(id);

    return createSuccessResponse(template);
  } catch (error) {
    console.error("Get template error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Template");
    }

    return createErrorResponse(error, "Failed to fetch template");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

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
  } catch (error) {
    console.error("Update template error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Template");
    }

    return createErrorResponse(error, "Failed to update template");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

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
  } catch (error) {
    console.error("Delete template error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Template");
    }

    return createErrorResponse(error, "Failed to delete template");
  }
}
