import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
// app/api/environments/[id]/templates/route.ts
import { isAdmin } from "@/lib/auth";
import {
  createErrorResponse,
  createSuccessResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { assignTemplateSchema } from "@/lib/validations/event-template";
import { EnvironmentRepository } from "@/lib/repositories/environment.repository";
import { EnvironmentMetadataRepository } from "@/lib/repositories/environment-metadata.repository";
const environmentRepo = new EnvironmentRepository();
const metadataRepo = new EnvironmentMetadataRepository();

export const GET = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const { id: environmentId } = await params;

  await environmentRepo.findById(environmentId);

  const templates = await metadataRepo.listEventTemplates(environmentId);

  return createSuccessResponse(templates);
}));

export const POST = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const admin = await isAdmin();
  if (!admin) return createForbiddenResponse("Admin access required");

  const { id: environmentId } = await params;

  await environmentRepo.findById(environmentId);

  const body = await request.json();
  const validated = assignTemplateSchema.parse(body);

  // Check not already assigned
  const existing = await metadataRepo.findEventTemplate(
    environmentId,
    validated.templateId,
  );
  if (existing) {
    return createErrorResponse(
      null,
      "Template already assigned to this event",
      409,
    );
  }

  const assignment = await metadataRepo.assignTemplate(
    environmentId,
    validated.templateId,
  );

  return createSuccessResponse(assignment, 201);
}));
