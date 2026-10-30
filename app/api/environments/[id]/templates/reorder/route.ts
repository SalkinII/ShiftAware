import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { isAdmin } from "@/lib/auth";
import {
  createSuccessResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { reorderTemplatesSchema } from "@/lib/validations/event-template";
import { EnvironmentRepository } from "@/lib/repositories/environment.repository";
import { EnvironmentMetadataRepository } from "@/lib/repositories/environment-metadata.repository";
const environmentRepo = new EnvironmentRepository();
const metadataRepo = new EnvironmentMetadataRepository();

export const PATCH = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const admin = await isAdmin();
  if (!admin) return createForbiddenResponse("Admin access required");

  const { id: environmentId } = await params;

  await environmentRepo.findById(environmentId);

  const body = await request.json();
  const validated = reorderTemplatesSchema.parse(body);

  await metadataRepo.reorderEventTemplates(environmentId, validated.order);

  return createSuccessResponse({ success: true });
}));
