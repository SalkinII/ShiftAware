import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { createAuditLog } from "@/lib/utils/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
} from "@/lib/api-errors";
import { AssignmentRepository } from "@/lib/repositories/assignment.repository";
import {
  createManualAssignment,
  deleteAssignment,
  runAllocation,
} from "@/lib/domain/allocation";

const assignmentRepo = new AssignmentRepository();

export const GET = withAuth(withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const environmentId = searchParams.get("environmentId");
  const teamMemberId = searchParams.get("teamMemberId");

  const where: any = {};
  if (environmentId) {
    where.shift = { environmentId };
  }
  if (teamMemberId) {
    where.teamMemberId = teamMemberId;
  }

  const assignments = await assignmentRepo.findAll(where);

  return createSuccessResponse(assignments);
}));

export const POST = withAuth(withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const { environmentId, preview, dryRun: dryRunBody, assignments } = body;

  // Manual assignment creation
  if (assignments && Array.isArray(assignments) && assignments.length > 0) {
    if (!environmentId) {
      return createErrorResponse(
        new Error("environmentId is required"),
        "environmentId is required",
        400,
      );
    }
    const created: any[] = [];
    for (const a of assignments) {
      const result = await createManualAssignment({
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
  if (!environmentId) {
    return createErrorResponse(
      new Error("environmentId is required"),
      "environmentId is required",
      400,
    );
  }

  const dryRun = !!(preview || dryRunBody);
  const result = await runAllocation(environmentId, dryRun);

  // Only create audit log if not dry-run
  if (!dryRun) {
    await createAuditLog({
      action: AuditAction.ASSIGNMENT_RUN,
      entityType: EntityType.CONFIG,
      entityId: environmentId,
      after: {
        assignmentsCount: result.assignments.length,
        violations: result.violations,
      },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });
  }

  return createSuccessResponse(result);
}));

export const DELETE = withAuth(withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return createErrorResponse(
      new Error("id is required"),
      "Assignment id is required",
      400,
    );
  }

  await deleteAssignment(id);

  await createAuditLog({
    action: AuditAction.DELETE,
    entityType: EntityType.ASSIGNMENT,
    entityId: id,
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
  });

  return createSuccessResponse({ deleted: true });
}));
