import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
// app/api/environments/[id]/templates/[templateId]/route.ts
import { isAdmin } from "@/lib/auth";
import {
  createSuccessResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { EnvironmentMetadataRepository } from "@/lib/repositories/environment-metadata.repository";
const metadataRepo = new EnvironmentMetadataRepository();

export const DELETE = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string; templateId: string }> },) => {

  const admin = await isAdmin();
  if (!admin) return createForbiddenResponse("Admin access required");

  const { id: environmentId, templateId } = await params;

  await metadataRepo.deleteEventTemplate(environmentId, templateId);

  return createSuccessResponse({ deleted: true });
}));
