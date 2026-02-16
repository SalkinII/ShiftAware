import { isAuthenticated } from "@/lib/auth";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { AssignmentsService } from "@/lib/services/assignments.service";
import { StatusGuardError } from "@/lib/services/event-status-guard";
import { RepositoryError } from "@/lib/repositories/base.repository";

const service = new AssignmentsService();

export async function GET(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const teamMemberId = searchParams.get("teamMemberId");

    const where: any = {};
    if (eventId) {
      where.shift = { eventId };
    }
    if (teamMemberId) {
      where.teamMemberId = teamMemberId;
    }

    const assignments = await service.listAssignments(where);

    return createSuccessResponse(assignments);
  } catch (error) {
    console.error("Get assignments error:", error);

    if (error instanceof RepositoryError) {
      return createErrorResponse(error, error.message);
    }

    return createErrorResponse(error, "Failed to fetch assignments");
  }
}

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const body = await request.json();
    const { eventId, preview, assignments } = body;

    // Manual assignment creation
    if (assignments && Array.isArray(assignments) && assignments.length > 0) {
      if (!eventId) {
        return createErrorResponse(
          new Error("eventId is required"),
          "eventId is required",
          400,
        );
      }
      const created: any[] = [];
      for (const a of assignments) {
        const result = await service.createManualAssignment({
          shiftId: a.shiftId,
          teamMemberId: a.teamMemberId,
          role: a.role || "TEAM_MEMBER",
          assignmentType: a.assignmentType || "MANUAL",
        });
        created.push(result);
        await createAuditLog({
          action: AuditAction.CREATE,
          entityType: EntityType.ASSIGNMENT,
          entityId: result.id,
          after: result,
          ipAddress: request.headers.get("x-forwarded-for") || undefined,
        });
      }
      return createSuccessResponse({ assignments: created }, 201);
    }

    // Algorithm run
    if (!eventId) {
      return createErrorResponse(
        new Error("eventId is required"),
        "eventId is required",
        400,
      );
    }

    const result = await service.runAllocation(eventId, preview);

    // Only create audit log if not preview
    if (!preview) {
      await createAuditLog({
        action: AuditAction.ASSIGNMENT_RUN,
        entityType: EntityType.CONFIG,
        entityId: eventId,
        after: {
          assignmentsCount: result.assignments.length,
          violations: result.violations,
        },
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });
    }

    return createSuccessResponse(result);
  } catch (error) {
    if (error instanceof StatusGuardError) {
      return createErrorResponse(error, error.message, 403);
    }
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }
    console.error("Run assignment algorithm error:", error);
    return createErrorResponse(error, "Failed to run assignment algorithm");
  }
}

export async function DELETE(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return createErrorResponse(
        new Error("id is required"),
        "Assignment id is required",
        400,
      );
    }

    await service.deleteAssignment(id);

    await createAuditLog({
      action: AuditAction.DELETE,
      entityType: EntityType.ASSIGNMENT,
      entityId: id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return createSuccessResponse({ deleted: true });
  } catch (error) {
    if (error instanceof StatusGuardError) {
      return createErrorResponse(error, error.message, 403);
    }
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Assignment");
    }
    return createErrorResponse(error, "Failed to delete assignment");
  }
}
