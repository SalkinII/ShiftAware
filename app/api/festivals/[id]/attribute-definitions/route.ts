import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { isAdmin } from "@/lib/auth";
import {
  createErrorResponse,
  createForbiddenResponse,
  createSuccessResponse,
} from "@/lib/api-errors";
import { attributeDefinitionSchema } from "@/lib/validations/attribute";
import { AttributeDefinitionRepository } from "@/lib/repositories/attribute-definition.repository";

const definitionRepo = new AttributeDefinitionRepository();

export const GET = withAuth(withErrorHandling(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id: festivalId } = await params;

  const definitions = await definitionRepo.findByFestivalWithUsage(festivalId);

  return createSuccessResponse(definitions);
}));

export const POST = withAuth(withErrorHandling(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  if (!(await isAdmin())) {
    return createForbiddenResponse("Only admins can add questions to the library");
  }

  const { id: festivalId } = await params;

  const body = await request.json();
  const definitionData = attributeDefinitionSchema.omit({ required: true }).parse(body);

  const existing = await definitionRepo.findByFestivalAndName(festivalId, definitionData.name);
  if (existing) {
    return createErrorResponse(
      new Error(`Attribute "${definitionData.name}" already exists for this festival`),
      `Attribute "${definitionData.name}" already exists for this festival`,
      409,
    );
  }

  const definition = await definitionRepo.create(festivalId, definitionData);

  return createSuccessResponse(definition, 201);
}));
