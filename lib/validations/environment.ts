import { z } from "zod";

// Base object schema (without cross-field refinement) so .partial() works
const environmentBaseSchema = z.object({
  name: z.string().min(1, "Event name is required").max(100),
  status: z
    .enum([
      "PLANNING",
      "OPEN_FOR_PREFERENCES",
      "ASSIGNING",
      "FINALIZED",
      "COMPLETED",
    ])
    .optional(),
  startDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), "Invalid start date"),
  endDate: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid end date"),
});

// Validation schema for creating an event
export const createEnvironmentSchema = environmentBaseSchema
  .extend({
    festivalId: z.string().min(1, "Festival is required"),
  })
  .refine(
    (data) => new Date(data.endDate) >= new Date(data.startDate),
    {
      message: "End date must be after start date",
      path: ["endDate"],
    },
  );

export const updateEnvironmentSchema = environmentBaseSchema
  .partial()
  .extend({
    id: z.string().min(1, "Event ID is required"),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate) {
      if (new Date(data.endDate) < new Date(data.startDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End date must be after start date",
          path: ["endDate"],
        });
      }
    }
  });
