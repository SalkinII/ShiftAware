import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    teamMemberAttribute: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/lib/db", () => db);

import { TeamMemberRepository } from "@/lib/repositories/team-member.repository";

describe("scoped visibility (security)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("attribute values read for an environment are limited to that environment's requirements", async () => {
    const repo = new TeamMemberRepository();

    await repo.getAttributes("member-1", "bar");

    expect(db.prisma.teamMemberAttribute.findMany).toHaveBeenCalledWith({
      where: {
        memberId: "member-1",
        definition: { requirements: { some: { environmentId: "bar" } } },
      },
      include: { definition: true },
    });
  });
});
