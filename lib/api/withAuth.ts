import { isAuthenticated } from "@/lib/auth";
import { createUnauthorizedResponse } from "@/lib/api-errors";

type Handler = (req: Request, ctx?: { params: Record<string, string | string[]> }) => Promise<Response>;

export function withAuth(handler: Handler): Handler {
  return async (req, ctx) => {
    if (!await isAuthenticated()) return createUnauthorizedResponse();
    return handler(req, ctx);
  };
}
