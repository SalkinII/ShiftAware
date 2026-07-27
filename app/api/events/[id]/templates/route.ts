import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
// app/api/events/[id]/templates/route.ts
import { isAdmin } from "@/lib/auth";
import {
  createErrorResponse,
  createSuccessResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { assignTemplateSchema } from "@/lib/validations/event-template";
import { EventRepository } from "@/lib/repositories/event.repository";
const eventRepo = new EventRepository();

export const GET = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const { id: eventId } = await params;

  await eventRepo.findById(eventId);

  const templates = await eventRepo.listEventTemplates(eventId);

  return createSuccessResponse(templates);
}));

export const POST = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const admin = await isAdmin();
  if (!admin) return createForbiddenResponse("Admin access required");

  const { id: eventId } = await params;

  await eventRepo.findById(eventId);

  const body = await request.json();
  const validated = assignTemplateSchema.parse(body);

  // Check not already assigned
  const existing = await eventRepo.findEventTemplate(
    eventId,
    validated.templateId,
  );
  if (existing) {
    return createErrorResponse(
      null,
      "Template already assigned to this event",
      409,
    );
  }

  const assignment = await eventRepo.assignTemplate(
    eventId,
    validated.templateId,
  );

  return createSuccessResponse(assignment, 201);
}));
