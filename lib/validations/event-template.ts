import { z } from "zod";

export const assignTemplateSchema = z.object({
  templateId: z.string().cuid(),
});
