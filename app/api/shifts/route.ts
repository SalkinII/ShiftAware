import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { shiftSchema } from "@/lib/validations/shift";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
} from "@/lib/api-errors";
import { ShiftsService } from "@/lib/services/shifts.service";
import { RepositoryError } from "@/lib/repositories/base.repository";

export async function GET(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    const shifts = await prisma.shift.findMany({
      where: eventId ? { eventId } : undefined,
      include: {
        event: true,
        requiredRoles: true,
        assignments: {
          select: {
            id: true,
            role: true,
            assignmentType: true,
            algorithmScore: true,
            notes: true,
            teamMember: {
              select: {
                id: true,
                alias: true,
                avatarId: true,
              },
            },
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

    return createSuccessResponse(shifts);
  } catch (error) {
    console.error("Get shifts error:", error);
    return createErrorResponse(error, "Failed to fetch shifts");
  }
}

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const body = await request.json();
    const validated = shiftSchema.parse(body);

    // Create shift with required roles
    const { requiredRoles, ...shiftData } = validated;

    const service = new ShiftsService();
    const shift = await service.createShift({
      ...shiftData,
      startTime: new Date(validated.startTime),
      endTime: new Date(validated.endTime),
      requiredRoles: {
        create: requiredRoles,
      },
    });

    await createAuditLog({
      action: AuditAction.CREATE,
      entityType: EntityType.SHIFT,
      entityId: shift.id,
      after: shift,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return createSuccessResponse(shift, 201);
  } catch (error) {
    if (error instanceof RepositoryError) {
      if (error.code === "NOT_FOUND") {
        return createErrorResponse(error, "Event not found", 404);
      }
    }
    console.error("Create shift error:", error);
    return createErrorResponse(error, "Failed to create shift");
  }
}
