import { z } from "zod";

const idSchema = z.string().min(1, "ID is required");

export const markerSchemaBase = z.object({
  eventId: idSchema,
  text: z.string().max(500),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

export const markerSchema = markerSchemaBase.refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  { message: "End time must be after start time" },
);

export const updateMarkerSchema = markerSchemaBase.partial().extend({
  id: idSchema,
});

export type MarkerInput = z.infer<typeof markerSchema>;
export type UpdateMarkerInput = z.infer<typeof updateMarkerSchema>;
