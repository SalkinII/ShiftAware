// lib/validations/event-registration.ts
import { z } from "zod";
import { RegistrationStatus } from "@prisma/client";

export const createRegistrationSchema = z.object({
  memberId: z.string().cuid(),
  status: z.nativeEnum(RegistrationStatus).optional().default("REGISTERED"),
});

export const updateRegistrationSchema = z.object({
  status: z.nativeEnum(RegistrationStatus),
});

export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>;
export type UpdateRegistrationInput = z.infer<typeof updateRegistrationSchema>;
