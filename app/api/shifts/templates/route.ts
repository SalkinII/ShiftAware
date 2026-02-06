import { prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import {
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

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const includeGlobal = searchParams.get("includeGlobal") !== "false";

    let where: any = {};

    if (eventId) {
      // Get templates for specific event: assigned globals + event-specific
      if (includeGlobal) {
        const assignments = await prisma.eventTemplate.findMany({
          where: { eventId },
          select: { templateId: true },
        });
        const assignedIds = assignments.map((a) => a.templateId);

        where = {
          OR: [{ id: { in: assignedIds } }, { eventId: eventId }],
        };
      } else {
        where = { eventId };
      }
    } else {
      // Get all global templates (no eventId)
      where = { eventId: null };
    }

    const templates = await prisma.shiftTemplate.findMany({
      where,
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

    // Log full error details for debugging
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      if (error.stack) console.error("Error stack:", error.stack);
    }

    // Check for Prisma client missing model error (common patterns)
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : "";

    if (
      errorMessage.includes("shiftTemplate") ||
      errorMessage.includes("Unknown model") ||
      errorMessage.includes("does not exist") ||
      errorMessage.includes("Cannot read property") ||
      errorName === "PrismaClientKnownRequestError" ||
      errorName === "TypeError"
    ) {
      const helpfulError = new Error(
        "Prisma client not regenerated. Stop dev server, run 'npm run db:migrate-safe' or 'npx prisma generate', then restart.",
      );
      return createErrorResponse(
        helpfulError,
        "Database models not available. Please regenerate Prisma client and restart the server.",
      );
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

    const template = await prisma.shiftTemplate.create({
      data: {
        ...templateData,
        eventId: templateData.eventId || null,
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

    // Log full error details for debugging
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      if (error.stack) console.error("Error stack:", error.stack);
    }

    // Check for Prisma client missing model error (common patterns)
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : "";

    if (
      errorMessage.includes("shiftTemplate") ||
      errorMessage.includes("Unknown model") ||
      errorMessage.includes("does not exist") ||
      errorMessage.includes("Cannot read property") ||
      errorName === "PrismaClientKnownRequestError" ||
      errorName === "TypeError"
    ) {
      const helpfulError = new Error(
        "Prisma client not regenerated. Stop dev server, run 'npm run db:migrate-safe' or 'npx prisma generate', then restart.",
      );
      return createErrorResponse(
        helpfulError,
        "Database models not available. Please regenerate Prisma client and restart the server.",
      );
    }

    return createErrorResponse(error, "Failed to create template");
  }
}
