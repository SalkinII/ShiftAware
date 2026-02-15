import { isAuthenticated } from "@/lib/auth";
import {
  createUnauthorizedResponse,
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/api-errors";
import { shiftTemplateSchema } from "@/lib/validations/template";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import { ShiftTemplatesService } from "@/lib/services/shift-templates.service";
import { RepositoryError } from "@/lib/repositories/base.repository";

const service = new ShiftTemplatesService();

export async function GET(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId") || undefined;
    const includeGlobal = searchParams.get("includeGlobal") !== "false";

    const templates = await service.listTemplates(eventId, includeGlobal);

    return createSuccessResponse(templates);
  } catch (error) {
    console.error("Get templates error:", error);

    if (error instanceof RepositoryError) {
      return createErrorResponse(error, error.message);
    }

    return createErrorResponse(error, "Failed to fetch templates");
  }
}

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const body = await request.json();
    const validated = shiftTemplateSchema.parse(body);

    const { requiredRoles, eventId, ...templateData } = validated;

    const template = await service.createTemplate({
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
  } catch (error) {
    console.error("Create template error:", error);

    if (error instanceof RepositoryError) {
      return createErrorResponse(error, error.message);
    }

    return createErrorResponse(error, "Failed to create template");
  }
}
