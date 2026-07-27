import { ZodError } from "zod";
import {
  createErrorResponse,
  createNotFoundResponse,
  createConflictResponse,
} from "@/lib/api-errors";
import { RepositoryError } from "@/lib/repositories/base.repository";

type AnyHandler = (...args: any[]) => Promise<Response>;

export function withErrorHandling(handler: AnyHandler): AnyHandler {
  return async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof RepositoryError) {
        if (error.code === "NOT_FOUND") return createNotFoundResponse();
        if (error.code === "DUPLICATE") return createConflictResponse(error.message);
        return createErrorResponse(error, error.message);
      }
      // StatusGuardError — check by name so no circular import needed
      if (error instanceof Error && error.name === "StatusGuardError") {
        return createConflictResponse(error.message);
      }
      if (error instanceof ZodError) {
        return createErrorResponse(error);
      }
      return createErrorResponse(error, "Internal server error");
    }
  };
}
