import { z } from "zod";
import { withAuth } from "@/lib/api/withAuth";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { createSuccessResponse } from "@/lib/api-errors";
import { redistributeScoped } from "@/lib/domain/allocation";

const schema = z.object({
  scope: z.object({
    memberIds: z.array(z.string()).optional(),
    shiftIds: z.array(z.string()).optional(),
  }),
  dryRun: z.boolean().optional().default(false),
});

export const POST = withAuth(withErrorHandling(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id: eventId } = await params;
  const body = schema.parse(await req.json());
  const result = await redistributeScoped(eventId, body.scope, body.dryRun);
  return createSuccessResponse(result);
}));
