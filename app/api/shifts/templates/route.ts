import { prisma } from "@/lib/db";
import {
  isAuthenticated,
  createUnauthorizedResponse,
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/api-errors";
import { shiftTemplateSchema } from "@/lib/validations/template";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    // Check if Prisma client has the new models
    if (!prisma.shiftTemplate) {
      console.error(
        "Prisma client missing shiftTemplate model. Run: npx prisma generate",
      );
      return createErrorResponse(
        new Error("Prisma client not updated. Please restart the dev server."),
        "Database models not available. Please restart the server.",
      );
    }

    const templates = await prisma.shiftTemplate.findMany({
      include: {
        requiredRoles: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return createSuccessResponse(templates);
  } catch (error) {
    console.error("Get templates error:", error);
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
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

    const { requiredRoles, ...templateData } = validated;

    // Check if Prisma client has the new models
    if (!prisma.shiftTemplate) {
      console.error(
        "Prisma client missing shiftTemplate model. Run: npx prisma generate",
      );
      return createErrorResponse(
        new Error("Prisma client not updated. Please restart the dev server."),
        "Database models not available. Please restart the server.",
      );
    }

    const template = await prisma.shiftTemplate.create({
      data: {
        ...templateData,
        requiredRoles: {
          create: requiredRoles,
        },
      },
      include: {
        requiredRoles: true,
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
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return createErrorResponse(error, "Failed to create template");
  }
}
