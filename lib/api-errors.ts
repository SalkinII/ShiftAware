import { NextResponse } from "next/server";
import { ZodError } from "zod";

export interface ApiErrorResponse {
  error: string;
  message?: string;
  details?: unknown;
  code?: string;
}

export interface ApiSuccessResponse<T> {
  data: T;
}

/**
 * Utility to unwrap API response data from { data: ... } format
 * Handles both wrapped and unwrapped formats for backwards compatibility
 */
export function unwrapApiResponse<T>(response: T | ApiSuccessResponse<T>): T {
  if (response && typeof response === "object" && "data" in response) {
    return (response as ApiSuccessResponse<T>).data;
  }
  return response as T;
}

/**
 * Standardized API error response format
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage = "Internal server error",
  status = 500,
): NextResponse<ApiErrorResponse> {
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation error",
        message: "Request validation failed",
        details: error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        })),
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  // Handle Error instances
  if (error instanceof Error) {
    // Don't expose internal errors in production
    const message =
      process.env.NODE_ENV === "production" ? defaultMessage : error.message;

    return NextResponse.json(
      {
        error: error.name || "Error",
        message,
        code: error.name,
      },
      { status: status },
    );
  }

  // Handle unknown errors
  return NextResponse.json(
    {
      error: "Internal server error",
      message: defaultMessage,
    },
    { status: 500 },
  );
}

/**
 * Create a standardized success response
 * Wraps data in { data: ... } format for consistency
 */
export function createSuccessResponse<T>(
  data: T,
  status = 200,
): NextResponse<{ data: T }> {
  return NextResponse.json({ data }, { status });
}

/**
 * Create a standardized not found response
 */
export function createNotFoundResponse(
  resource = "Resource",
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: "Not found",
      message: `${resource} not found`,
      code: "NOT_FOUND",
    },
    { status: 404 },
  );
}

/**
 * Create a standardized unauthorized response
 */
export function createUnauthorizedResponse(
  message = "Unauthorized",
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: "Unauthorized",
      message,
      code: "UNAUTHORIZED",
    },
    { status: 401 },
  );
}

/**
 * Create a standardized conflict response
 */
export function createConflictResponse(
  message = "Resource conflict",
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: "Conflict",
      message,
      code: "CONFLICT",
    },
    { status: 409 },
  );
}
