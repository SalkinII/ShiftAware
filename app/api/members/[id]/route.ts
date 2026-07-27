import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/db";
import { updateTeamMemberSchema } from "@/lib/validations/team-member";
import { createAuditLog } from "@/lib/services/audit";
import { MembersService } from "@/lib/services/members.service";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createSuccessResponse,
  createNotFoundResponse,
  createConflictResponse,
} from "@/lib/api-errors";
const service = new MembersService();

export const GET = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const { id } = await params;
  const member = await service.getMemberWithRelations(id);

  return createSuccessResponse(member);
}));

export const PUT = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const { id: memberId } = await params;
  const body = await request.json();
  const validated = updateTeamMemberSchema.parse({ ...body, id: memberId });

  const existing = await prisma.teamMember.findUnique({
    where: { id: memberId },
  });

  if (!existing) {
    return createNotFoundResponse("Team member");
  }

  // Check alias uniqueness if changing alias
  if (validated.alias && validated.alias !== existing.alias) {
    const aliasExists = await prisma.teamMember.findUnique({
      where: { alias: validated.alias },
    });
    if (aliasExists) {
      return createConflictResponse("Alias already exists");
    }
  }

  const { id, ...updateData } = validated;
  const before = { ...existing };
  const member = await service.updateMember(id, updateData);

  await createAuditLog({
    action: AuditAction.UPDATE,
    entityType: EntityType.TEAM_MEMBER,
    entityId: member.id,
    before,
    after: member,
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
  });

  return createSuccessResponse(member);
}));

export const DELETE = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const { id } = await params;
  const member = await service.getMember(id);

  // Soft delete by setting isActive to false
  const deleted = await service.deactivateMember(id);

  await createAuditLog({
    action: AuditAction.DELETE,
    entityType: EntityType.TEAM_MEMBER,
    entityId: member.id,
    before: member,
    after: deleted,
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
  });

  return createSuccessResponse(deleted);
}));
