/**
 * Client-safe event status permissions.
 * No prisma import — safe for "use client" components.
 */
import type { EventStatus } from "@prisma/client";

export type GuardAction =
  | "SHIFT_MUTATE"
  | "PREFERENCE_MUTATE"
  | "ASSIGNMENT_MUTATE"
  | "REGISTRATION_MUTATE";

export const PERMISSION_MAP: Record<
  EventStatus,
  Record<GuardAction, boolean>
> = {
  PLANNING: {
    SHIFT_MUTATE: true,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_MUTATE: false,
    REGISTRATION_MUTATE: true,
  },
  OPEN_FOR_PREFERENCES: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: true,
    ASSIGNMENT_MUTATE: false,
    REGISTRATION_MUTATE: true,
  },
  ASSIGNING: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_MUTATE: true,
    REGISTRATION_MUTATE: false,
  },
  FINALIZED: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_MUTATE: false,
    REGISTRATION_MUTATE: false,
  },
  COMPLETED: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_MUTATE: false,
    REGISTRATION_MUTATE: false,
  },
};

/**
 * Pure client-safe check — no DB call.
 * Returns true if SHIFT_MUTATE is allowed for the given event status.
 */
export function canMutateShifts(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.SHIFT_MUTATE === true;
}
