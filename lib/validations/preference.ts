import { z } from "zod";
import { PreferenceLevel } from "@prisma/client";

// More lenient ID validation: accepts CUID format or any non-empty string
// This handles cases where IDs might not be strict CUIDs but are valid database IDs
const idSchema = z
  .string()
  .min(1, "ID is required")
  .refine(
    (val) => {
      // Accept CUID format (starts with 'c' and is 25 chars) or any reasonable ID format
      return z.string().cuid().safeParse(val).success || val.length >= 10;
    },
    { message: "Invalid ID format" },
  );

export const preferenceSchema = z.object({
  teamMemberId: z.string().cuid(),
  shiftId: z.string().cuid(),
  wantLevel: z.nativeEnum(PreferenceLevel),
  notes: z.string().max(500).optional(),
});

export const preferencesSubmissionSchema = z.object({
  teamMemberId: idSchema,
  preferences: z.array(preferenceSchema).min(2, "Minimum 2 shifts required"),
});

export type PreferenceInput = z.infer<typeof preferenceSchema>;
export type PreferencesSubmissionInput = z.infer<
  typeof preferencesSubmissionSchema
>;
