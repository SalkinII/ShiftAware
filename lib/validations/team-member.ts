import { z } from "zod";
import { ExperienceLevel, Role } from "@prisma/client";

// Reserved emojis - not available for team member avatar selection
// 🐻 = Admin, 🦥 = Default/Unassigned
export const RESERVED_AVATAR_EMOJIS = ["🐻", "🦥"] as const;

export const teamMemberSchema = z.object({
  alias: z.string().min(1).max(50),
  avatarId: z
    .string()
    .min(1)
    .refine((val) => !RESERVED_AVATAR_EMOJIS.includes(val as any), {
      message: `Avatar emoji cannot be one of: ${RESERVED_AVATAR_EMOJIS.join(", ")} (reserved for system use)`,
    }),
  experienceLevel: z.nativeEnum(ExperienceLevel),
  genderRole: z.string().min(1),
  capabilities: z.array(z.nativeEnum(Role)).min(1),
  isActive: z.boolean().optional().default(true),
});

export const updateTeamMemberSchema = teamMemberSchema.partial().extend({
  id: z.string().cuid(),
});

export type TeamMemberInput = z.infer<typeof teamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
