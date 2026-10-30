import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { isAdmin } from "@/lib/auth";
import {
  createNotFoundResponse,
  createSuccessResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { attributeDefinitionSchema } from "@/lib/validations/attribute";
import { EnvironmentRepository } from "@/lib/repositories/environment.repository";
import { EnvironmentMetadataRepository } from "@/lib/repositories/environment-metadata.repository";
import { AttributeDefinitionRepository } from "@/lib/repositories/attribute-definition.repository";
const environmentRepo = new EnvironmentRepository();
const metadataRepo = new EnvironmentMetadataRepository();
const definitionRepo = new AttributeDefinitionRepository();

export const PUT = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string; attrId: string }> },) => {

  const admin = await isAdmin();
  if (!admin) return createForbiddenResponse("Admin access required");

  const { id: environmentId, attrId } = await params;

  const environment = await environmentRepo.findById(environmentId);

  const body = await request.json();
  const validated = attributeDefinitionSchema.partial().parse(body);
  const { required, ...definitionData } = validated;

  const definition = await definitionRepo.findByIdInFestival(environment.festivalId, attrId);
  if (!definition) return createNotFoundResponse("Attribute");

  const updated = Object.keys(definitionData).length > 0
    ? await definitionRepo.update(attrId, definitionData)
    : definition;

  if (required !== undefined) {
    await metadataRepo.setAttributeRequirement(environmentId, attrId, required);
  }

  return createSuccessResponse(updated);
}));

export const DELETE = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string; attrId: string }> },) => {

  const admin = await isAdmin();
  if (!admin) return createForbiddenResponse("Admin access required");

  const { id: environmentId, attrId } = await params;

  await metadataRepo.removeAttributeRequirement(environmentId, attrId);

  return createSuccessResponse({ deleted: true });
}));
