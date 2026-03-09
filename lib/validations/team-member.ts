import { z } from "zod";
import { ExperienceLevel, Role } from "@prisma/client";
import { RESERVED_EMOJIS, isReservedEmoji } from "@/lib/constants/emojis";

// Re-export for backwards compatibility
export const RESERVED_AVATAR_EMOJIS = RESERVED_EMOJIS;

export const teamMemberSchema = z.object({
  alias: z.string().min(1).max(50),
  avatarId: z
    .string()
    .min(1)
    .refine((val) => !isReservedEmoji(val), {
      message: `Avatar emoji cannot be one of: ${RESERVED_EMOJIS.join(", ")} (reserved for system use)`,
    }),
  experienceLevel: z.nativeEnum(ExperienceLevel).optional().default(ExperienceLevel.INTERMEDIATE),
  capabilities: z.array(z.nativeEnum(Role)).min(1),
  isActive: z.boolean().optional().default(true),
});

export const updateTeamMemberSchema = teamMemberSchema.partial().extend({
  id: z.string().cuid(),
});

export type TeamMemberInput = z.infer<typeof teamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
