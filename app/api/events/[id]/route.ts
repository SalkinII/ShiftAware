import { NextResponse } from "next/server";
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { EventsService } from "@/lib/services/events.service";
import { RepositoryError } from "@/lib/repositories/base.repository";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { createAuditLog, AuditAction, EntityType } from "@/lib/services/audit";

const service = new EventsService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAuthenticated())) {
      return createUnauthorizedResponse();
    }

    const { id } = await params;
    const event = await service.getEvent(id);
    return createSuccessResponse(event);
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }
    return createErrorResponse(error, "Failed to fetch event");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAdmin())) {
      return createUnauthorizedResponse();
    }

    const { id } = await params;
    const body = await request.json();
    const event = await service.updateEvent(id, body);

    await createAuditLog({
      action: AuditAction.UPDATE,
      entityType: EntityType.EVENT,
      entityId: id,
      after: body,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return createSuccessResponse(event);
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }
    return createErrorResponse(error, "Failed to update event");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAdmin())) {
      return createUnauthorizedResponse();
    }

    const { id } = await params;
    await service.deleteEvent(id);

    await createAuditLog({
      action: AuditAction.DELETE,
      entityType: EntityType.EVENT,
      entityId: id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return createSuccessResponse({ deleted: true });
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }
    return createErrorResponse(error, "Failed to delete event");
  }
}
