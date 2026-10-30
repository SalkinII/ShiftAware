import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { createSuccessResponse } from "@/lib/api-errors";
import { resolveMissingAttributesForEnvironment } from "@/lib/domain/attribute-requirements";
import { TeamMemberRepository } from "@/lib/repositories/team-member.repository";

const memberRepo = new TeamMemberRepository();

export const GET = withAuth(withErrorHandling(async (
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) => {
  const { id: environmentId, memberId } = await params;

  const missing = await resolveMissingAttributesForEnvironment(memberId, environmentId);
  const answers = await memberRepo.getAttributes(memberId, environmentId);

  return createSuccessResponse({ missing, answers });
}));
