import { prisma } from "@/lib/db";
import type { EventStatus } from "@prisma/client";

export type GuardAction =
  | "SHIFT_MUTATE"
  | "PREFERENCE_MUTATE"
  | "ASSIGNMENT_MUTATE"
  | "REGISTRATION_MUTATE";

export class StatusGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatusGuardError";
  }
}

const PERMISSION_MAP: Record<EventStatus, Record<GuardAction, boolean>> = {
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

export async function assertEventStatusAllows(
  eventId: string,
  action: GuardAction,
): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { status: true },
  });

  if (!event) {
    throw new StatusGuardError("Event not found");
  }

  const allowed = PERMISSION_MAP[event.status]?.[action];

  if (!allowed) {
    throw new StatusGuardError(
      `Action not allowed: event status is ${event.status}`,
    );
  }
}
