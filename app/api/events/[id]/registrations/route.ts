// app/api/events/[id]/registrations/route.ts
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { createRegistrationSchema } from "@/lib/validations/event-registration";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id: eventId } = await params;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return createNotFoundResponse("Event not found");

    const registrations = await prisma.eventRegistration.findMany({
      where: { eventId },
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
      orderBy: { registeredAt: "asc" },
    });

    return createSuccessResponse(registrations);
  } catch (error) {
    console.error("Get event registrations error:", error);
    return createErrorResponse(error, "Failed to fetch registrations");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
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
    const validated = createRegistrationSchema.parse(body);

    // Check member exists
    const member = await prisma.teamMember.findUnique({
      where: { id: validated.memberId },
    });
    if (!member) return createNotFoundResponse("Member not found");

    // Check not already registered
    const existing = await prisma.eventRegistration.findUnique({
      where: { memberId_eventId: { memberId: validated.memberId, eventId } },
    });
    if (existing) {
      return createErrorResponse(
        null,
        "Member already registered for this event",
        409,
      );
    }

    const registration = await prisma.eventRegistration.create({
      data: {
        memberId: validated.memberId,
        eventId,
        status: validated.status,
      },
      include: { member: true },
    });

    return createSuccessResponse(registration, 201);
  } catch (error) {
    console.error("Create registration error:", error);
    return createErrorResponse(error, "Failed to register member");
  }
}
