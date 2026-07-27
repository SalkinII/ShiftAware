import { withAuth } from "@/lib/api/withAuth";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { createSuccessResponse } from "@/lib/api-errors";
import { runAllocation } from "@/lib/domain/allocation";

export const POST = withAuth(withErrorHandling(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id: eventId } = await params;
  const result = await runAllocation(eventId, true);
  return createSuccessResponse(result);
}));
