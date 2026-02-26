import { prisma } from "@/lib/db";
import { PERMISSION_MAP, type GuardAction } from "./event-status-permissions";

// Re-export client-safe items for backward compatibility
export {
  canMutateShifts,
  canRunAlgorithm,
  canManuallyAssign,
  canMutateEvent,
  PERMISSION_MAP,
} from "./event-status-permissions";
export type { GuardAction } from "./event-status-permissions";

export class StatusGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatusGuardError";
  }
}

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
