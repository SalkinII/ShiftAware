import { z } from "zod";
import { AttributeType } from "@prisma/client";

export const attributeDefinitionSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-z_]+$/, "Use lowercase with underscores"),
  label: z.string().min(1).max(100),
  type: z.nativeEnum(AttributeType),
  options: z.array(z.string()).default([]),
  required: z.boolean().default(false),
});

export type AttributeDefinitionInput = z.infer<typeof attributeDefinitionSchema>;
