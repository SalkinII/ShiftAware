import { z } from "zod";

export const assignTemplateSchema = z.object({
  templateId: z.string().cuid(),
});

export const reorderTemplatesSchema = z.object({
  order: z
    .array(
      z.object({
        templateId: z.string().cuid(),
        order: z.number().int().min(0),
      }),
    )
    .min(1),
});
