import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { shiftSchema } from "@/lib/validations/shift";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    const shifts = await prisma.shift.findMany({
      where: eventId ? { eventId } : undefined,
      include: {
        event: true,
        requiredRoles: true,
        assignments: {
          include: {
            teamMember: true,
          },
        },
        _count: {
          select: {
            preferences: true,
            assignments: true,
          },
        },
      },
      orderBy: { startTime: "asc" },
    });

    return NextResponse.json(shifts);
  } catch (error) {
    console.error("Get shifts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = shiftSchema.parse(body);

    // Create shift with required roles
    const { requiredRoles, ...shiftData } = validated;
    
    const shift = await prisma.shift.create({
      data: {
        ...shiftData,
        startTime: new Date(validated.startTime),
        endTime: new Date(validated.endTime),
        requiredRoles: {
          create: requiredRoles,
        },
      },
      include: {
        requiredRoles: true,
        event: true,
      },
    });

    await createAuditLog({
      action: AuditAction.CREATE,
      entityType: EntityType.SHIFT,
      entityId: shift.id,
      after: shift,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error },
        { status: 400 }
      );
    }
    console.error("Create shift error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

