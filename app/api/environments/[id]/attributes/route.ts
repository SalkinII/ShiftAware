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

  // Check for duplicate attribute name
  const existing = await definitionRepo.findByFestivalAndName(environment.festivalId, validated.name);
  if (existing) {
    return createErrorResponse(
      new Error(
        `Attribute "${validated.name}" already exists for this festival`,
      ),
      `Attribute "${validated.name}" already exists for this festival`,
      409,
    );
  }

  const attribute = await definitionRepo.create(environment.festivalId, definitionData);
  await metadataRepo.setAttributeRequirement(environmentId, attribute.id, required);

  return createSuccessResponse({ ...attribute, required }, 201);
}));
