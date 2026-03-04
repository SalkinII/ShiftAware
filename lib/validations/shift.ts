import { z } from "zod";
import { ShiftType, ShiftPriority, Role } from "@prisma/client";

// More lenient ID validation: accepts CUID format or any non-empty string
// This handles cases where IDs might not be strict CUIDs but are valid database IDs
const idSchema = z
  .string()
  .min(1, "ID is required")
  .refine(
    (val) => {
      // Accept CUID format (starts with 'c' and is 25 chars) or any reasonable ID format
      return z.string().cuid().safeParse(val).success || val.length >= 10;
    },
    { message: "Invalid ID format" },
  );

export const shiftRoleSchema = z.object({
  role: z.nativeEnum(Role),
  count: z.number().int().nonnegative().default(1),
});

export const shiftSchemaBase = z.object({
  eventId: idSchema,
  type: z.nativeEnum(ShiftType),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  priority: z.nativeEnum(ShiftPriority).default("CORE"),
  desirabilityScore: z.number().int().min(1).max(5).default(3),
  requiredRoles: z.array(shiftRoleSchema).min(0),
  capacity: z.number().int().nonnegative().default(0),
  isTemplate: z.boolean().optional().default(false),
  templateId: z.string().cuid().nullable().optional(),
});

export const shiftSchema = shiftSchemaBase
  .refine(
    (data) => {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      return end > start;
    },
    { message: "End time must be after start time" },
  )
  .refine(
    (data) => {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      const calculatedMinutes = Math.round(
        (end.getTime() - start.getTime()) / (1000 * 60),
      );
      return calculatedMinutes === data.durationMinutes;
    },
    { message: "Duration must match time difference" },
  );

export const updateShiftSchema = shiftSchemaBase.partial().extend({
  id: idSchema,
});

export type ShiftInput = z.infer<typeof shiftSchema>;
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;
