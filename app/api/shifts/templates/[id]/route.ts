import { prisma } from "@/lib/db";
import {
  isAuthenticated,
  createUnauthorizedResponse,
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { shiftTemplateSchema } from "@/lib/validations/template";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { id } = await params;
    const template = await prisma.shiftTemplate.findUnique({
      where: { id },
      include: {
        requiredRoles: true,
      },
    });

    if (!template) {
      return createNotFoundResponse("Template");
    }

    return createSuccessResponse(template);
  } catch (error) {
    console.error("Get template error:", error);
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
    const existing = await prisma.shiftTemplate.findUnique({
      where: { id },
      include: { requiredRoles: true },
    });

    if (!existing) {
      return createNotFoundResponse("Template");
    }

    // Update template and roles
    const template = await prisma.shiftTemplate.update({
      where: { id },
      data: {
        ...templateData,
        requiredRoles: {
          deleteMany: {},
          create: requiredRoles,
        },
      },
      include: {
        requiredRoles: true,
      },
    });

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

    const existing = await prisma.shiftTemplate.findUnique({
      where: { id },
      include: { requiredRoles: true },
    });

    if (!existing) {
      return createNotFoundResponse("Template");
    }

    await prisma.shiftTemplate.delete({
      where: { id },
    });

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
    return createErrorResponse(error, "Failed to delete template");
  }
}
