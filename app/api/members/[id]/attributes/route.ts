import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
// app/api/members/[id]/attributes/route.ts
import {
  createSuccessResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { createAttributeSchema } from "@/lib/validations/member-attribute";
import { MembersService } from "@/lib/services/members.service";
const service = new MembersService();

export const GET = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

  const { id: memberId } = await params;
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId") || undefined;

  const attributes = await service.getAttributes(memberId, eventId);

  return createSuccessResponse(attributes);
}));

export const POST = withAuth(withErrorHandling(async (request: Request,
  { params }: { params: Promise<{ id: string }> },) => {

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
}));
