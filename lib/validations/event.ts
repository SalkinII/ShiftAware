import { z } from "zod";

// Validation schema for creating an event
export const createEventSchema = z
  .object({
    name: z.string().min(1, "Event name is required").max(100),
    startDate: z
      .string()
      .refine((d) => !isNaN(Date.parse(d)), "Invalid start date"),
    endDate: z
      .string()
      .refine((d) => !isNaN(Date.parse(d)), "Invalid end date"),
    bufferDaysBefore: z.number().int().min(0).max(30).default(1),
    bufferDaysAfter: z.number().int().min(0).max(30).default(1),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export const updateEventSchema = createEventSchema.partial().extend({
  id: z.string().cuid(),
});
