import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { teamMemberSchema } from "@/lib/validations/team-member";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createConflictResponse,
} from "@/lib/api-errors";

export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const members = await prisma.teamMember.findMany({
      orderBy: { alias: "asc" },
      include: {
        _count: {
          select: {
            preferences: true,
            assignments: true,
          },
        },
      },
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

    const member = await prisma.teamMember.create({
      data: validated,
    });

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
