import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { isAdmin } from "@/lib/auth";
import { MembersService } from "@/lib/services/members.service";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";

const service = new MembersService();

export const DELETE = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  if (!(await isAdmin())) {
    return createUnauthorizedResponse();
  }

  const { id } = await params;

  const member = await service.getMember(id);
  if (!member) {
    return createNotFoundResponse("Team member");
  }

  try {
    await service.permanentDeleteMember(id);
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBER_STILL_ACTIVE") {
      return createErrorResponse(
        new Error("Member must be deactivated before permanent deletion"),
        "Member must be deactivated before permanent deletion",
        409,
      );
    }
    throw error;
  }

  await createAuditLog({
    action: AuditAction.DELETE,
    entityType: EntityType.TEAM_MEMBER,
    entityId: id,
    before: { id: member.id, alias: member.alias, isActive: member.isActive },
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
  });

  return createSuccessResponse({ success: true });
}));
