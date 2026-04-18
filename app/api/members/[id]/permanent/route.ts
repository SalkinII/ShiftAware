import { isAdmin } from "@/lib/auth";
import { MembersService } from "@/lib/services/members.service";
import { RepositoryError } from "@/lib/repositories/base.repository";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";

const service = new MembersService();

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAdmin())) {
      return createUnauthorizedResponse();
    }

    const { id } = await params;

    const member = await service.getMember(id);
    if (!member) {
      return createNotFoundResponse("Team member");
    }

    await service.permanentDeleteMember(id);

    await createAuditLog({
      action: AuditAction.DELETE,
      entityType: EntityType.TEAM_MEMBER,
      entityId: id,
      before: { id: member.id, alias: member.alias, isActive: member.isActive },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return createSuccessResponse({ success: true });
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Team member");
    }
    if (error instanceof Error && error.message === "MEMBER_STILL_ACTIVE") {
      return createErrorResponse(
        new Error("Member must be deactivated before permanent deletion"),
        "Member must be deactivated before permanent deletion",
        409,
      );
    }
    console.error("Permanent delete member error:", error);
    return createErrorResponse(error, "Failed to permanently delete member");
  }
}
