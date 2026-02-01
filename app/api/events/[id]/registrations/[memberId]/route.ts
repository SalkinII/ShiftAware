// app/api/events/[id]/registrations/[memberId]/route.ts
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { updateRegistrationSchema } from "@/lib/validations/event-registration";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id: eventId, memberId } = await params;

    const registration = await prisma.eventRegistration.findUnique({
      where: { memberId_eventId: { memberId, eventId } },
      include: {
        member: {
          include: {
            attributes: {
              include: { definition: true },
              where: { definition: { eventId } },
            },
          },
        },
      },
    });

    if (!registration) return createNotFoundResponse("Registration not found");

    return createSuccessResponse(registration);
  } catch (error) {
    console.error("Get registration error:", error);
    return createErrorResponse(error, "Failed to fetch registration");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId, memberId } = await params;

    const existing = await prisma.eventRegistration.findUnique({
      where: { memberId_eventId: { memberId, eventId } },
    });
    if (!existing) return createNotFoundResponse("Registration not found");

    const body = await request.json();
    const validated = updateRegistrationSchema.parse(body);

    const updated = await prisma.eventRegistration.update({
      where: { memberId_eventId: { memberId, eventId } },
      data: validated,
      include: { member: true },
    });

    return createSuccessResponse(updated);
  } catch (error) {
    console.error("Update registration error:", error);
    return createErrorResponse(error, "Failed to update registration");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId, memberId } = await params;

    const existing = await prisma.eventRegistration.findUnique({
      where: { memberId_eventId: { memberId, eventId } },
    });
    if (!existing) return createNotFoundResponse("Registration not found");

    await prisma.eventRegistration.delete({
      where: { memberId_eventId: { memberId, eventId } },
    });

    return createSuccessResponse({ deleted: true });
  } catch (error) {
    console.error("Delete registration error:", error);
    return createErrorResponse(error, "Failed to remove registration");
  }
}
