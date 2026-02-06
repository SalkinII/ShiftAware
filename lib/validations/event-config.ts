import { z } from "zod";

export const eventConfigSchema = z.object({
  minShiftsPerPerson: z.number().int().min(0).default(2),
  bufferDaysBefore: z.number().int().min(0).max(14).default(1),
  bufferDaysAfter: z.number().int().min(0).max(14).default(1),
  algorithmWeights: z.record(z.number()).optional(),
  balanceThresholds: z.record(z.number()).optional(),
  autoAssignUnfilled: z.boolean().default(true),
});
