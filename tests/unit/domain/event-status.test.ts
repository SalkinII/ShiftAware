/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";
import { assertEventStatusAllows, StatusGuardError, canRunAlgorithm } from "@/lib/domain/event-status";

vi.mock("@/lib/db", () => ({
  prisma: { event: { findUnique: vi.fn() } },
}));

describe("assertEventStatusAllows", () => {
  it("throws StatusGuardError when action not allowed", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ status: "PLANNING" } as any);
    await expect(assertEventStatusAllows("evt-1", "ASSIGNMENT_ALGORITHM"))
      .rejects.toThrow(StatusGuardError);
  });

  it("resolves when action is allowed", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ status: "ASSIGNING" } as any);
    await expect(assertEventStatusAllows("evt-1", "ASSIGNMENT_ALGORITHM"))
      .resolves.toBeUndefined();
  });

  it("throws StatusGuardError when event not found", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);
    await expect(assertEventStatusAllows("evt-1", "SHIFT_MUTATE"))
      .rejects.toThrow(StatusGuardError);
  });
});

describe("canRunAlgorithm", () => {
  it("returns true for ASSIGNING status", () => {
    expect(canRunAlgorithm("ASSIGNING")).toBe(true);
  });
  it("returns false for PLANNING status", () => {
    expect(canRunAlgorithm("PLANNING")).toBe(false);
  });
});
