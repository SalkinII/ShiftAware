import { prisma } from "@/lib/db";
import { getMissingAttributes, type AttributeDefinitionLike } from "@/lib/utils/attribute-check";

export async function resolveMissingAttributesForEnvironment(
  memberId: string,
  environmentId: string,
): Promise<AttributeDefinitionLike[]> {
  const requirements = await prisma.environmentAttributeRequirement.findMany({
    where: { environmentId },
    include: { definition: true },
  });

  const answered = await prisma.teamMemberAttribute.findMany({
    where: { memberId, definitionId: { in: requirements.map((r) => r.definitionId) } },
  include: { definition: true },
  });

  const definitions: AttributeDefinitionLike[] = requirements.map((r) => ({
    ...r.definition,
    required: r.required,
  }));

  const values = answered.map((a) => ({ definition: { name: a.definition.name }, value: a.value }));

  return getMissingAttributes(definitions, values);
}
