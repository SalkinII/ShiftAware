import { isAuthenticated, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { attributeDefinitionSchema } from "@/lib/validations/attribute";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; attrId: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId, attrId } = await params;

    const existing = await prisma.eventAttributeDefinition.findFirst({
      where: { id: attrId, eventId },
    });
    if (!existing) return createNotFoundResponse("Attribute not found");

    const body = await request.json();
    const validated = attributeDefinitionSchema.partial().parse(body);

    const updated = await prisma.eventAttributeDefinition.update({
      where: { id: attrId },
      data: validated,
    });

    return createSuccessResponse(updated);
  } catch (error) {
    console.error("Update attribute error:", error);
    return createErrorResponse(error, "Failed to update attribute");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; attrId: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId, attrId } = await params;

    const existing = await prisma.eventAttributeDefinition.findFirst({
      where: { id: attrId, eventId },
    });
    if (!existing) return createNotFoundResponse("Attribute not found");

    await prisma.eventAttributeDefinition.delete({ where: { id: attrId } });

    return createSuccessResponse({ deleted: true });
  } catch (error) {
    console.error("Delete attribute error:", error);
    return createErrorResponse(error, "Failed to delete attribute");
  }
}
