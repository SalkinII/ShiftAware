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
import { ShiftsService } from "@/lib/services/shifts.service";
import { RepositoryError } from "@/lib/repositories/base.repository";

const service = new ShiftsService();

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
    const shift = await service.getShiftWithDetails(id);
    return createSuccessResponse(shift);
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Shift");
    }
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

    // Prepare shift data with date conversions
    const shiftData = {
      ...updateData,
      startTime: updateData.startTime
        ? new Date(updateData.startTime)
        : undefined,
      endTime: updateData.endTime ? new Date(updateData.endTime) : undefined,
    };

    const shift = await service.updateShiftWithRoles(
      id,
      shiftData,
      requiredRoles,
    );

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
    if (error instanceof RepositoryError) {
      if (error.code === "NOT_FOUND") {
        return createNotFoundResponse("Shift");
      }
    }
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

    await service.cascadeDeleteShift(shiftId);

    await createAuditLog({
      action: AuditAction.DELETE,
      entityType: EntityType.SHIFT,
      entityId: shift.id,
      before: shift,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return createSuccessResponse({ success: true });
  } catch (error) {
    if (error instanceof RepositoryError) {
      if (error.code === "NOT_FOUND") {
        return createNotFoundResponse("Shift");
      }
      if (error.code === "CONFLICT") {
        return createConflictResponse(error.message);
      }
    }
    console.error("Delete shift error:", error);
    return createErrorResponse(error, "Failed to delete shift");
  }
}
