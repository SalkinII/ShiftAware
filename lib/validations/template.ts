import { z } from "zod";
import { ShiftType, ShiftPriority, Role } from "@prisma/client";

const idSchema = z.string().min(1);

const templateRoleSchema = z.object({
  role: z.nativeEnum(Role),
  count: z.number().int().positive().default(1),
});

export const shiftTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  type: z.nativeEnum(ShiftType),
  durationMinutes: z.number().int().positive(),
  startTime: z
    .string()
    .regex(
      /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/,
      "Start time must be in HH:MM format",
    ),
  priority: z.nativeEnum(ShiftPriority).default("CORE"),
  desirabilityScore: z.number().int().min(1).max(5).default(3),
  capacity: z.number().int().positive().default(2),
  color: z.string().optional(),
  requiredRoles: z
    .array(templateRoleSchema)
    .min(1, "At least one required role is needed"),
});

export const scheduleTemplateSchema = z.object({
  templateId: idSchema,
  eventId: idSchema,
  date: z.string().datetime(), // ISO date string
});

export type ShiftTemplateInput = z.infer<typeof shiftTemplateSchema>;
export type ScheduleTemplateInput = z.infer<typeof scheduleTemplateSchema>;
