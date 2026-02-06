// lib/validations/swap-request.ts
import { z } from "zod";
import { SwapStatus } from "@prisma/client";

export const createSwapRequestSchema = z.object({
  fromAssignmentId: z.string().cuid(),
  toShiftId: z.string().cuid(),
});

export const updateSwapRequestSchema = z.object({
  status: z.nativeEnum(SwapStatus),
});

export type CreateSwapRequestInput = z.infer<typeof createSwapRequestSchema>;
export type UpdateSwapRequestInput = z.infer<typeof updateSwapRequestSchema>;
