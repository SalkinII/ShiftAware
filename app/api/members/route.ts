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
    const includeUnregistered =
      searchParams.get("includeUnregistered") === "true";

    let where: any = { isActive: true };
    let include: any = {};

    if (eventId) {
      if (includeUnregistered) {
        // Return all members, mark which are registered
        include = {
          eventRegistrations: {
            where: { eventId },
          },
          attributes: {
            where: { definition: { eventId } },
            include: { definition: true },
          },
        };
      } else {
        // Only members registered for this event
        where = {
          ...where,
          eventRegistrations: {
            some: { eventId },
          },
        };
        include = {
          eventRegistrations: {
            where: { eventId },
          },
          attributes: {
            where: { definition: { eventId } },
            include: { definition: true },
          },
        };
      }
    }

    const members = await prisma.teamMember.findMany({
      where,
      include,
      orderBy: { alias: "asc" },
    });

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
