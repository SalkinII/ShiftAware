import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { teamMemberSchema } from "@/lib/validations/team-member";
import { createAuditLog } from "@/lib/services/audit";
import { MembersService } from "@/lib/services/members.service";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createConflictResponse,
} from "@/lib/api-errors";

const service = new MembersService();

export async function GET(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const includeUnregistered = searchParams.get("includeUnregistered") === "true";

    let members;
    if (eventId) {
      members = await service.listMembersWithEventContext(eventId, includeUnregistered);
    } else {
      members = await service.listMembers({ isActive: true });
    }

    return createSuccessResponse(members);
  } catch (error) {
    console.error("Get members error:", error);
    return createErrorResponse(error, "Failed to fetch members");
  }
}

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

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
  } catch (error) {
    console.error("Create member error:", error);
    return createErrorResponse(error, "Failed to create member");
  }
}
