import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const body = await request.json();
    const { assignment1Id, assignment2Id, reason } = body;

    if (!assignment1Id || !assignment2Id) {
      return createErrorResponse(
        new Error("Two assignments are required for a swap"),
        "Two assignments are required for a swap",
        400,
      );
    }

    // Get both assignments
    const [a1, a2] = await Promise.all([
      prisma.assignment.findUnique({
        where: { id: assignment1Id },
        include: { shift: true },
      }),
      prisma.assignment.findUnique({
        where: { id: assignment2Id },
        include: { shift: true },
      }),
    ]);

    if (!a1 || !a2) {
      return createNotFoundResponse("Assignment");
    }

    // Perform swap in transaction
    const [newA1, newA2] = await prisma.$transaction([
      prisma.assignment.update({
        where: { id: a1.id },
        data: { teamMemberId: a2.teamMemberId, assignmentType: "SWAP" },
      }),
      prisma.assignment.update({
        where: { id: a2.id },
        data: { teamMemberId: a1.teamMemberId, assignmentType: "SWAP" },
      }),
    ]);

    await createAuditLog({
      action: AuditAction.MANUAL_SWAP,
      entityType: EntityType.ASSIGNMENT,
      entityId: `${a1.id}<->${a2.id}`,
      before: { a1: a1.teamMemberId, a2: a2.teamMemberId },
      after: { a1: a2.teamMemberId, a2: a1.teamMemberId },
      reason: reason || "Manual administrator swap",
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return createSuccessResponse({ success: true, a1: newA1, a2: newA2 });
  } catch (error) {
    console.error("Swap assignments error:", error);
    return createErrorResponse(error, "Failed to swap assignments");
  }
}
