import { isAuthenticated, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
  createForbiddenResponse,
} from "@/lib/api-errors";
import { attributeDefinitionSchema } from "@/lib/validations/attribute";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { id: eventId } = await params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return createNotFoundResponse("Event not found");
    }

    const attributes = await prisma.eventAttributeDefinition.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
    });

    return createSuccessResponse(attributes);
  } catch (error) {
    console.error("Get event attributes error:", error);
    return createErrorResponse(error, "Failed to fetch event attributes");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId } = await params;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return createNotFoundResponse("Event not found");

    const body = await request.json();
    const validated = attributeDefinitionSchema.parse(body);

    const attribute = await prisma.eventAttributeDefinition.create({
      data: {
        ...validated,
        eventId,
      },
    });

    return createSuccessResponse(attribute, 201);
  } catch (error) {
    console.error("Create attribute error:", error);
    return createErrorResponse(error, "Failed to create attribute");
  }
}
