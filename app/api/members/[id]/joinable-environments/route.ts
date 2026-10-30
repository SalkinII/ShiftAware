import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { createSuccessResponse } from "@/lib/api-errors";
import { resolveMissingAttributesForEnvironment } from "@/lib/domain/attribute-requirements";
import { EnvironmentRepository } from "@/lib/repositories/environment.repository";
import { TeamMemberRepository } from "@/lib/repositories/team-member.repository";

const environmentRepo = new EnvironmentRepository();
const memberRepo = new TeamMemberRepository();

export const GET = withAuth(withErrorHandling(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id: memberId } = await params;

  const member = await memberRepo.findByIdWithRelations(memberId);
  const joined = new Set(member?.environmentRegistrations.map((r) => r.environmentId));

  const environments = await environmentRepo.findAllWithStats();
  const joinable = await Promise.all(
    environments
      .filter((environment) => !joined.has(environment.id))
      .map(async (environment) => ({
        id: environment.id,
        name: environment.name,
        festivalId: environment.festivalId,
        status: environment.status,
        missingQuestionCount: (await resolveMissingAttributesForEnvironment(memberId, environment.id)).length,
      })),
  );

  return createSuccessResponse(joinable);
}));
