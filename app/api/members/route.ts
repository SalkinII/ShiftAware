import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/db";
import { teamMemberSchema } from "@/lib/validations/team-member";
import { createAuditLog } from "@/lib/services/audit";
import { MembersService } from "@/lib/services/members.service";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createSuccessResponse,
  createConflictResponse,
} from "@/lib/api-errors";
const service = new MembersService();

export const GET = withAuth(withErrorHandling(async (request: Request) => {

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const search = searchParams.get("search");
  const includeUnregistered =
    searchParams.get("includeUnregistered") === "true";

  let members;
  if (eventId) {
    members = await service.listMembersWithEventContext(
      eventId,
      includeUnregistered,
      search || undefined,
    );
  } else {
    const includeInactive = searchParams.get("includeInactive") === "true";
    const where: any = includeInactive ? {} : { isActive: true };
    if (search) {
      where.alias = { contains: search, mode: "insensitive" };
    }
    members = await service.listMembers(where);
  }

  return createSuccessResponse(members);
}));

export const POST = withAuth(withErrorHandling(async (request: Request) => {

  const body = await request.json();
  const validated = teamMemberSchema.parse(body);

  // Check if alias already exists
  const existing = await prisma.teamMember.findUnique({
    where: { alias: validated.alias },
  });

  if (existing) {
    return createConflictResponse("Alias already exists");
  }

  const member = await service.createMember(validated);

  await createAuditLog({
    action: AuditAction.CREATE,
    entityType: EntityType.TEAM_MEMBER,
    entityId: member.id,
    after: validated,
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
  });

  return createSuccessResponse(member, 201);
}));
