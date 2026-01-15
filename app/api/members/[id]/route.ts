import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateTeamMemberSchema } from "@/lib/validations/team-member";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const member = await prisma.teamMember.findUnique({
      where: { id },
      include: {
        preferences: {
          include: { shift: true },
          orderBy: { priority: "asc" },
        },
        assignments: {
          include: { shift: true },
          orderBy: { shift: { startTime: "asc" } },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error("Get member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: memberId } = await params;
    const body = await request.json();
    const validated = updateTeamMemberSchema.parse({ ...body, id: memberId });

    const existing = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Check alias uniqueness if changing alias
    if (validated.alias && validated.alias !== existing.alias) {
      const aliasExists = await prisma.teamMember.findUnique({
        where: { alias: validated.alias },
      });
      if (aliasExists) {
        return NextResponse.json(
          { error: "Alias already exists" },
          { status: 409 },
        );
      }
    }

    const { id, ...updateData } = validated;
    const before = { ...existing };
    const member = await prisma.teamMember.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      action: AuditAction.UPDATE,
      entityType: EntityType.TEAM_MEMBER,
      entityId: member.id,
      before,
      after: member,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(member);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error },
        { status: 400 },
      );
    }
    console.error("Update member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const member = await prisma.teamMember.findUnique({
      where: { id },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Soft delete by setting isActive to false
    const deleted = await prisma.teamMember.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      action: AuditAction.DELETE,
      entityType: EntityType.TEAM_MEMBER,
      entityId: member.id,
      before: member,
      after: deleted,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(deleted);
  } catch (error) {
    console.error("Delete member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
