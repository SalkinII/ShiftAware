import { z } from "zod";

const allocationRuleSchema = z.object({
  id: z.string(),
  shiftType: z.string(),
  attribute: z.string(),
  operator: z.enum(["EQUALS", "NOT_EQUALS", "CONTAINS"]),
  value: z.string(),
  balanceMode: z.enum(["REQUIRE_ONE", "REQUIRE_RATIO"]).optional(),
  minRatio: z.number().min(0).max(1).optional(),
  maxRatio: z.number().min(0).max(1).optional(),
});

export const eventConfigSchema = z.object({
  minShiftsPerPerson: z.number().int().min(0).default(2),
  bufferDaysBefore: z.number().int().min(0).max(14).default(1),
  bufferDaysAfter: z.number().int().min(0).max(14).default(1),
  algorithmWeights: z.record(z.number()).optional(),
  balanceThresholds: z.record(z.number()).optional(),
  autoAssignUnfilled: z.boolean().default(true),
  allocationRules: z.array(allocationRuleSchema).optional().default([]),
});
