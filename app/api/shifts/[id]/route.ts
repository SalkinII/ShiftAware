import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateShiftSchema } from "@/lib/validations/shift";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
  createConflictResponse,
} from "@/lib/api-errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { id } = await params;
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        event: true,
        requiredRoles: true,
        preferences: {
          include: { teamMember: true },
          orderBy: { priority: "asc" },
        },
        assignments: {
          include: { teamMember: true },
        },
      },
    });

    if (!shift) {
      return createNotFoundResponse("Shift");
    }

    return createSuccessResponse(shift);
  } catch (error) {
    console.error("Get shift error:", error);
    return createErrorResponse(error, "Failed to fetch shift");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { id: shiftId } = await params;
    const body = await request.json();
    const validated = updateShiftSchema.parse({ ...body, id: shiftId });

    const existing = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: { requiredRoles: true },
    });

    if (!existing) {
      return createNotFoundResponse("Shift");
    }

    const { id, requiredRoles, ...updateData } = validated;
    const before = { ...existing };

    // Update shift and roles
    const shift = await prisma.$transaction(async (tx) => {
      // Delete existing roles if new ones provided
      if (requiredRoles) {
        await tx.shiftRole.deleteMany({ where: { shiftId: id } });
      }

      const updated = await tx.shift.update({
        where: { id },
        data: {
          ...updateData,
          startTime: updateData.startTime
            ? new Date(updateData.startTime)
            : undefined,
          endTime: updateData.endTime
            ? new Date(updateData.endTime)
            : undefined,
          ...(requiredRoles && {
            requiredRoles: {
              create: requiredRoles,
            },
          }),
        },
        include: {
          requiredRoles: true,
          event: true,
        },
      });

      return updated;
    });

    await createAuditLog({
      action: AuditAction.UPDATE,
      entityType: EntityType.SHIFT,
      entityId: shift.id,
      before,
      after: shift,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return createSuccessResponse(shift);
  } catch (error) {
    console.error("Update shift error:", error);
    return createErrorResponse(error, "Failed to update shift");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { id: shiftId } = await params;
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: { requiredRoles: true },
    });

    if (!shift) {
      return createNotFoundResponse("Shift");
    }

    // Check if shift has assignments
    const assignmentCount = await prisma.assignment.count({
      where: { shiftId },
    });

    if (assignmentCount > 0) {
      return createConflictResponse(
        "Cannot delete shift with existing assignments",
      );
    }

    await prisma.shift.delete({
      where: { id: shiftId },
    });

    await createAuditLog({
      action: AuditAction.DELETE,
      entityType: EntityType.SHIFT,
      entityId: shift.id,
      before: shift,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return createSuccessResponse({ success: true });
  } catch (error) {
    console.error("Delete shift error:", error);
    return createErrorResponse(error, "Failed to delete shift");
  }
}
