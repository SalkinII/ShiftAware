// app/api/members/[id]/attributes/route.ts
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { z } from "zod";

const createAttributeSchema = z.object({
  eventId: z.string().cuid(),
  key: z.string().min(1),
  value: z.union([z.string(), z.boolean(), z.array(z.string())]),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id: memberId } = await params;
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    const where: any = { memberId };
    if (eventId) {
      where.definition = { eventId };
    }

    const attributes = await prisma.teamMemberAttribute.findMany({
      where,
      include: { definition: true },
    });

    return createSuccessResponse(attributes);
  } catch (error) {
    console.error("Get member attributes error:", error);
    return createErrorResponse(error, "Failed to fetch attributes");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id: memberId } = await params;

    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });
    if (!member) return createNotFoundResponse("Member not found");

    const body = await request.json();
    const validated = createAttributeSchema.parse(body);

    // Find attribute definition
    const definition = await prisma.eventAttributeDefinition.findFirst({
      where: {
        eventId: validated.eventId,
        name: validated.key,
      },
    });

    if (!definition) {
      return createNotFoundResponse(
        `Attribute definition '${validated.key}' not found for this event`,
      );
    }

    // Upsert attribute value
    const attribute = await prisma.teamMemberAttribute.upsert({
      where: {
        teamMemberId_definitionId: {
          teamMemberId: memberId,
          definitionId: definition.id,
        },
      },
      update: {
        value: JSON.stringify(validated.value),
      },
      create: {
        teamMemberId: memberId,
        definitionId: definition.id,
        value: JSON.stringify(validated.value),
      },
      include: { definition: true },
    });

    return createSuccessResponse(attribute, 201);
  } catch (error) {
    console.error("Create member attribute error:", error);
    return createErrorResponse(error, "Failed to save attribute");
  }
}
