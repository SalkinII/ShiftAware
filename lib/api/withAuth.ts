import { isAuthenticated } from "@/lib/auth";
import { createUnauthorizedResponse } from "@/lib/api-errors";

type AnyHandler = (...args: any[]) => Promise<Response>;

export function withAuth(handler: AnyHandler): AnyHandler {
  return async (...args: any[]) => {
    if (!(await isAuthenticated())) return createUnauthorizedResponse();
    return handler(...args);
  };
}
