// app/api/swap-requests/route.ts
import { isAuthenticated } from "@/lib/auth";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
} from "@/lib/api-errors";
import { createSwapRequestSchema } from "@/lib/validations/swap-request";
import { SwapRequestsService } from "@/lib/services/swap-requests.service";
import { RepositoryError } from "@/lib/repositories/base.repository";

const service = new SwapRequestsService();

export async function GET(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");
    const eventId = searchParams.get("eventId");
    const status = searchParams.get("status");

    let where: any = {};

    if (memberId) {
      where.requesterId = memberId;
    }

    if (eventId) {
      where.toShift = { eventId };
    }

    if (status) {
      where.status = status;
    }

    const requests = await service.listSwapRequests(where);

    return createSuccessResponse(requests);
  } catch (error) {
    console.error("Get swap requests error:", error);

    if (error instanceof RepositoryError) {
      return createErrorResponse(error, error.message);
    }

    return createErrorResponse(error, "Failed to fetch swap requests");
  }
}

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const body = await request.json();
    const validated = createSwapRequestSchema.parse(body);

    const swapRequest = await service.createSwapRequest(
      validated.fromAssignmentId,
      validated.toShiftId,
    );

    return createSuccessResponse(swapRequest, 201);
  } catch (error) {
    console.error("Create swap request error:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return createErrorResponse(error, error.message, 404);
      }
      if (error.message.includes("different events")) {
        return createErrorResponse(error, error.message, 400);
      }
    }

    if (error instanceof RepositoryError) {
      return createErrorResponse(error, error.message);
    }

    return createErrorResponse(error, "Failed to create swap request");
  }
}
