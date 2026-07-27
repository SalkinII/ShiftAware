import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import {
  createSuccessResponse,
} from "@/lib/api-errors";
import { scheduleTemplateSchema } from "@/lib/validations/template";
import { setHours, setMinutes } from "date-fns";
import { ShiftTemplateRepository } from "@/lib/repositories/shift-template.repository";

const templateRepo = new ShiftTemplateRepository();

export const POST = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {
  const { id: templateId } = await params;
  const body = await request.json();
  const validated = scheduleTemplateSchema.parse({ ...body, templateId });

  // Get template for validation
  const template = await templateRepo.findById(templateId);

  // Parse date and template startTime
  const date = new Date(validated.date);
  const [hours, minutes] = template.startTime.split(":").map(Number);
  const startTime = setMinutes(setHours(date, hours), minutes);

  // Create scheduled shift
  const scheduledShift = await templateRepo.createScheduledShift(
    templateId,
    validated.eventId,
    startTime,
  );

  return createSuccessResponse(scheduledShift, 201);
}));
