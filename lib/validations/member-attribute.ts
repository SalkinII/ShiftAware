import { z } from "zod";

export const createAttributeSchema = z.object({
  eventId: z.string().cuid(),
  key: z.string().min(1),
  value: z.union([z.string(), z.boolean(), z.array(z.string())]),
});
