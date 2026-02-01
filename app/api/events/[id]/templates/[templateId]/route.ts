// app/api/events/[id]/templates/[templateId]/route.ts
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; templateId: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId, templateId } = await params;

    const existing = await prisma.eventTemplate.findUnique({
      where: { eventId_templateId: { eventId, templateId } },
    });
    if (!existing)
      return createNotFoundResponse("Template assignment not found");

    await prisma.eventTemplate.delete({
      where: { eventId_templateId: { eventId, templateId } },
    });

    return createSuccessResponse({ deleted: true });
  } catch (error) {
    console.error("Unassign template error:", error);
    return createErrorResponse(error, "Failed to unassign template");
  }
}
