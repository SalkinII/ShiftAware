import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  assertEventStatusAllows,
  StatusGuardError,
  type GuardAction,
} from "@/lib/services/event-status-guard";
import type { EventStatus } from "@prisma/client";

vi.mock("@/lib/db", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
    },
  },
}));

const { prisma } = await import("@/lib/db");

const EVENT_STATUSES: EventStatus[] = [
  "PLANNING",
  "OPEN_FOR_PREFERENCES",
  "ASSIGNING",
  "FINALIZED",
  "COMPLETED",
];

const GUARD_ACTIONS: GuardAction[] = [
  "SHIFT_MUTATE",
  "PREFERENCE_MUTATE",
  "ASSIGNMENT_ALGORITHM",
  "ASSIGNMENT_MANUAL",
  "REGISTRATION_MUTATE",
];

const ALLOWED_MATRIX: Record<EventStatus, GuardAction[]> = {
  PLANNING: ["SHIFT_MUTATE", "REGISTRATION_MUTATE"],
  OPEN_FOR_PREFERENCES: ["PREFERENCE_MUTATE", "REGISTRATION_MUTATE"],
  ASSIGNING: [
    "ASSIGNMENT_ALGORITHM",
    "ASSIGNMENT_MANUAL",
    "REGISTRATION_MUTATE",
  ],
  FINALIZED: ["ASSIGNMENT_MANUAL", "REGISTRATION_MUTATE"],
  COMPLETED: [],
};

describe("event-status-guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws StatusGuardError when event not found", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

    await expect(
      assertEventStatusAllows("nonexistent", "SHIFT_MUTATE"),
    ).rejects.toThrow(StatusGuardError);

    await expect(
      assertEventStatusAllows("nonexistent", "SHIFT_MUTATE"),
    ).rejects.toThrow("Event not found");
  });

  for (const status of EVENT_STATUSES) {
    for (const action of GUARD_ACTIONS) {
      const allowed = ALLOWED_MATRIX[status].includes(action);
      it(`${status} / ${action}: ${allowed ? "allows" : "blocks"}`, async () => {
        vi.mocked(prisma.event.findUnique).mockResolvedValue({
          id: "evt-1",
          status,
          name: "Test",
          startDate: new Date(),
          endDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);

        if (allowed) {
          await expect(
            assertEventStatusAllows("evt-1", action),
          ).resolves.toBeUndefined();
        } else {
          await expect(
            assertEventStatusAllows("evt-1", action),
          ).rejects.toThrow(StatusGuardError);

          await expect(
            assertEventStatusAllows("evt-1", action),
          ).rejects.toThrow(/Action not allowed/);
        }
      });
    }
  }
});
