// Merged from: lib/services/event-status-guard.ts + lib/services/event-status-permissions.ts
import { prisma } from "@/lib/db";
import type { EventStatus } from "@prisma/client";

export type GuardAction =
  | "SHIFT_MUTATE"
  | "PREFERENCE_MUTATE"
  | "ASSIGNMENT_ALGORITHM"
  | "ASSIGNMENT_MANUAL"
  | "REGISTRATION_MUTATE"
  | "EVENT_MUTATE"
  | "EVENT_DELETE";

export class StatusGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatusGuardError";
  }
}

export const PERMISSION_MAP: Record<EventStatus, Record<GuardAction, boolean>> = {
  PLANNING: {
    SHIFT_MUTATE: true, PREFERENCE_MUTATE: false, ASSIGNMENT_ALGORITHM: false,
    ASSIGNMENT_MANUAL: false, REGISTRATION_MUTATE: true, EVENT_MUTATE: true, EVENT_DELETE: true,
  },
  OPEN_FOR_PREFERENCES: {
    SHIFT_MUTATE: false, PREFERENCE_MUTATE: true, ASSIGNMENT_ALGORITHM: false,
    ASSIGNMENT_MANUAL: false, REGISTRATION_MUTATE: true, EVENT_MUTATE: false, EVENT_DELETE: false,
  },
  ASSIGNING: {
    SHIFT_MUTATE: false, PREFERENCE_MUTATE: false, ASSIGNMENT_ALGORITHM: true,
    ASSIGNMENT_MANUAL: true, REGISTRATION_MUTATE: true, EVENT_MUTATE: false, EVENT_DELETE: false,
  },
  FINALIZED: {
    SHIFT_MUTATE: false, PREFERENCE_MUTATE: false, ASSIGNMENT_ALGORITHM: false,
    ASSIGNMENT_MANUAL: true, REGISTRATION_MUTATE: true, EVENT_MUTATE: false, EVENT_DELETE: false,
  },
  COMPLETED: {
    SHIFT_MUTATE: false, PREFERENCE_MUTATE: false, ASSIGNMENT_ALGORITHM: false,
    ASSIGNMENT_MANUAL: false, REGISTRATION_MUTATE: false, EVENT_MUTATE: false, EVENT_DELETE: true,
  },
};

export async function assertEventStatusAllows(eventId: string, action: GuardAction): Promise<void> {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { status: true } });
  if (!event) throw new StatusGuardError("Event not found");
  if (!PERMISSION_MAP[event.status]?.[action]) {
    throw new StatusGuardError(`Action not allowed: event status is ${event.status}`);
  }
}

export function canMutateShifts(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.SHIFT_MUTATE === true;
}
export function canRunAlgorithm(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.ASSIGNMENT_ALGORITHM === true;
}
export function canManuallyAssign(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.ASSIGNMENT_MANUAL === true;
}
export function canMutateEvent(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.EVENT_MUTATE === true;
}
export function canShowSwapPanel(status: EventStatus): boolean {
  return status === "ASSIGNING" || status === "FINALIZED";
}
export function canDeleteEvent(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.EVENT_DELETE === true;
}
