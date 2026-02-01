// app/api/events/[id]/templates/route.ts
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { z } from "zod";

const assignTemplateSchema = z.object({
  templateId: z.string().cuid(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id: eventId } = await params;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return createNotFoundResponse("Event not found");

    // Get assigned global templates
    const assignments = await prisma.eventTemplate.findMany({
      where: { eventId },
      include: {
        template: {
          include: { requiredRoles: true },
        },
      },
    });

    // Get event-specific templates
    const eventSpecific = await prisma.shiftTemplate.findMany({
      where: { eventId },
      include: { requiredRoles: true },
    });

    return createSuccessResponse({
      assigned: assignments.map((a) => ({
        ...a.template,
        assignmentId: a.id,
        isGlobal: true,
      })),
      eventSpecific: eventSpecific.map((t) => ({
        ...t,
        isGlobal: false,
      })),
    });
  } catch (error) {
    console.error("Get event templates error:", error);
    return createErrorResponse(error, "Failed to fetch templates");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId } = await params;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return createNotFoundResponse("Event not found");

    const body = await request.json();
    const validated = assignTemplateSchema.parse(body);

    // Check template exists and is global
    const template = await prisma.shiftTemplate.findUnique({
      where: { id: validated.templateId },
    });
    if (!template) return createNotFoundResponse("Template not found");
    if (template.eventId) {
      return createErrorResponse(
        null,
        "Cannot assign event-specific template to another event",
        400,
      );
    }

    // Check not already assigned
    const existing = await prisma.eventTemplate.findUnique({
      where: {
        eventId_templateId: { eventId, templateId: validated.templateId },
      },
    });
    if (existing) {
      return createErrorResponse(
        null,
        "Template already assigned to this event",
        409,
      );
    }

    const assignment = await prisma.eventTemplate.create({
      data: {
        eventId,
        templateId: validated.templateId,
      },
      include: { template: true },
    });

    return createSuccessResponse(assignment, 201);
  } catch (error) {
    console.error("Assign template error:", error);
    return createErrorResponse(error, "Failed to assign template");
  }
}
