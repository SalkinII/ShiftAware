import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  isAuthenticated,
  createUnauthorizedResponse,
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { scheduleTemplateSchema } from "@/lib/validations/template";
import { setHours, setMinutes, addMinutes } from "date-fns";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { id: templateId } = await params;
    const body = await request.json();
    const validated = scheduleTemplateSchema.parse({ ...body, templateId });

    // Get template
    const template = await prisma.shiftTemplate.findUnique({
      where: { id: templateId },
      include: { requiredRoles: true },
    });

    if (!template) {
      return createNotFoundResponse("Template");
    }

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: validated.eventId },
    });

    if (!event) {
      return createNotFoundResponse("Event");
    }

    // Parse date and template startTime
    const date = new Date(validated.date);
    const [hours, minutes] = template.startTime.split(":").map(Number);
    const startTime = setMinutes(setHours(date, hours), minutes);
    const endTime = addMinutes(startTime, template.durationMinutes);

    // Create scheduled shift
    const scheduledShift = await prisma.scheduledShift.create({
      data: {
        templateId: template.id,
        eventId: validated.eventId,
        date: startTime,
      },
    });

    // Optionally create actual shift immediately
    // For now, just return scheduled shift - conversion happens on save

    return createSuccessResponse(scheduledShift, 201);
  } catch (error) {
    console.error("Schedule template error:", error);
    return createErrorResponse(error, "Failed to schedule template");
  }
}
