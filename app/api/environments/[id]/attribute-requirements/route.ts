import { z } from "zod";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { isAdmin } from "@/lib/auth";
import {
  createForbiddenResponse,
  createNotFoundResponse,
  createSuccessResponse,
} from "@/lib/api-errors";
import { EnvironmentRepository } from "@/lib/repositories/environment.repository";
import { EnvironmentMetadataRepository } from "@/lib/repositories/environment-metadata.repository";
import { AttributeDefinitionRepository } from "@/lib/repositories/attribute-definition.repository";

const environmentRepo = new EnvironmentRepository();
const metadataRepo = new EnvironmentMetadataRepository();
const definitionRepo = new AttributeDefinitionRepository();

const setRequirementSchema = z.object({
  definitionId: z.string(),
  required: z.boolean(),
});

const removeRequirementSchema = z.object({
  definitionId: z.string(),
});

export const GET = withAuth(withErrorHandling(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id: environmentId } = await params;

  const requirements = await metadataRepo.listAttributeRequirements(environmentId);

  return createSuccessResponse(requirements);
}));

export const POST = withAuth(withErrorHandling(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  if (!(await isAdmin())) {
    return createForbiddenResponse("Only admins can set environment attribute requirements");
  }

  const { id: environmentId } = await params;
  const environment = await environmentRepo.findById(environmentId);

  const { definitionId, required } = setRequirementSchema.parse(await request.json());

  // A requirement may only link a question from this environment's own festival
  const definition = await definitionRepo.findByIdInFestival(environment.festivalId, definitionId);
  if (!definition) return createNotFoundResponse("Attribute");

  const requirement = await metadataRepo.setAttributeRequirement(environmentId, definitionId, required);

  return createSuccessResponse(requirement, 201);
}));

export const DELETE = withAuth(withErrorHandling(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  if (!(await isAdmin())) {
    return createForbiddenResponse("Only admins can remove environment attribute requirements");
  }

  const { id: environmentId } = await params;
  const { definitionId } = removeRequirementSchema.parse(await request.json());

  await metadataRepo.removeAttributeRequirement(environmentId, definitionId);

  return createSuccessResponse({ removed: true });
}));
