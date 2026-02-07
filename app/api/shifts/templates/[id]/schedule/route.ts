import { isAuthenticated } from "@/lib/auth";
import {
  createUnauthorizedResponse,
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { scheduleTemplateSchema } from "@/lib/validations/template";
import { setHours, setMinutes } from "date-fns";
import { ShiftTemplatesService } from "@/lib/services/shift-templates.service";
import { RepositoryError } from "@/lib/repositories/base.repository";

const service = new ShiftTemplatesService();

export async function POST(
  request: Request,
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

    // Get template for validation
    const template = await service.getTemplate(templateId);

    // Parse date and template startTime
    const date = new Date(validated.date);
    const [hours, minutes] = template.startTime.split(":").map(Number);
    const startTime = setMinutes(setHours(date, hours), minutes);

    // Create scheduled shift
    const scheduledShift = await service.scheduleTemplate(
      templateId,
      validated.eventId,
      startTime,
    );

    return createSuccessResponse(scheduledShift, 201);
  } catch (error) {
    console.error("Schedule template error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Template");
    }

    return createErrorResponse(error, "Failed to schedule template");
  }
}
