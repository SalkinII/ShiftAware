import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { isAdmin } from "@/lib/auth";
import {
  createErrorResponse,
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

export const GET = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {
  const { id: environmentId } = await params;

  await environmentRepo.findById(environmentId);

  const attributes = await metadataRepo.listAttributeRequirements(environmentId);

  return createSuccessResponse(attributes);
}));

export const POST = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const admin = await isAdmin();
  if (!admin) return createForbiddenResponse("Admin access required");

  const { id: environmentId } = await params;

  const environment = await environmentRepo.findById(environmentId);

  const body = await request.json();
  const validated = attributeDefinitionSchema.parse(body);
  const { required, ...definitionData } = validated;

  // The festival already has this question: attach it when it matches, refuse it when it differs
  const existing = await definitionRepo.findByFestivalAndName(environment.festivalId, validated.name);
  if (existing) {
    const sameQuestion =
      existing.type === validated.type &&
      JSON.stringify(existing.options) === JSON.stringify(validated.options);
    if (!sameQuestion) {
      const message = `Attribute "${validated.name}" already exists for this festival with a different type or options`;
      return createErrorResponse(new Error(message), message, 409);
    }
    await metadataRepo.setAttributeRequirement(environmentId, existing.id, required);
    return createSuccessResponse({ ...existing, required }, 201);
  }

  const attribute = await definitionRepo.create(environment.festivalId, definitionData);
  await metadataRepo.setAttributeRequirement(environmentId, attribute.id, required);

  return createSuccessResponse({ ...attribute, required }, 201);
}));
