import { z } from "zod";

// Base object schema (without cross-field refinement) so .partial() works
const festivalBaseSchema = z.object({
  name: z.string().trim().min(1, "Festival name is required").max(100),
  startDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), "Invalid start date"),
  endDate: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid end date"),
});

// Validation schema for creating a festival
export const createFestivalSchema = festivalBaseSchema.refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  {
    message: "End date must be after start date",
    path: ["endDate"],
  },
);

export const updateFestivalSchema = festivalBaseSchema
  .partial()
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
