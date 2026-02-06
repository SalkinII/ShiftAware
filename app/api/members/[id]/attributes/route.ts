// app/api/members/[id]/attributes/route.ts
import { isAuthenticated } from "@/lib/auth";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { createAttributeSchema } from "@/lib/validations/member-attribute";
import { MembersService } from "@/lib/services/members.service";
import { RepositoryError } from "@/lib/repositories/base.repository";

const service = new MembersService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id: memberId } = await params;
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId") || undefined;

    const attributes = await service.getAttributes(memberId, eventId);

    return createSuccessResponse(attributes);
  } catch (error) {
    console.error("Get member attributes error:", error);

    if (error instanceof RepositoryError) {
      return createErrorResponse(error, error.message);
    }

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

    await service.getMember(memberId);

    const body = await request.json();
    const validated = createAttributeSchema.parse(body);

    // Find attribute definition
    const definition = await service.findAttributeDefinition(
      validated.eventId,
      validated.key,
    );

    if (!definition) {
      return createNotFoundResponse(
        `Attribute definition '${validated.key}' not found for this event`,
      );
    }

    // Upsert attribute value
    const attribute = await service.upsertAttribute(
      memberId,
      definition.id,
      JSON.stringify(validated.value),
    );

    return createSuccessResponse(attribute, 201);
  } catch (error) {
    console.error("Create member attribute error:", error);

    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Member");
    }

    return createErrorResponse(error, "Failed to save attribute");
  }
}
