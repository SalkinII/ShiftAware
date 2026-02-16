/**
 * Client-safe event status permissions.
 * No prisma import — safe for "use client" components.
 */
import type { EventStatus } from "@prisma/client";

export type GuardAction =
  | "SHIFT_MUTATE"
  | "PREFERENCE_MUTATE"
  | "ASSIGNMENT_ALGORITHM"
  | "ASSIGNMENT_MANUAL"
  | "REGISTRATION_MUTATE";

export const PERMISSION_MAP: Record<
  EventStatus,
  Record<GuardAction, boolean>
> = {
  PLANNING: {
    SHIFT_MUTATE: true,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_ALGORITHM: false,
    ASSIGNMENT_MANUAL: false,
    REGISTRATION_MUTATE: true,
  },
  OPEN_FOR_PREFERENCES: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: true,
    ASSIGNMENT_ALGORITHM: false,
    ASSIGNMENT_MANUAL: false,
    REGISTRATION_MUTATE: true,
  },
  ASSIGNING: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_ALGORITHM: true,
    ASSIGNMENT_MANUAL: true,
    REGISTRATION_MUTATE: true,
  },
  FINALIZED: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_ALGORITHM: false,
    ASSIGNMENT_MANUAL: true,
    REGISTRATION_MUTATE: true,
  },
  COMPLETED: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_ALGORITHM: false,
    ASSIGNMENT_MANUAL: false,
    REGISTRATION_MUTATE: false,
  },
};

/**
 * Pure client-safe check — no DB call.
 */
export function canMutateShifts(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.SHIFT_MUTATE === true;
}

export function canRunAlgorithm(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.ASSIGNMENT_ALGORITHM === true;
}

export function canManuallyAssign(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.ASSIGNMENT_MANUAL === true;
}
