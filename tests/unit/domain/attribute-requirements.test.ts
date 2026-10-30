import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    environmentAttributeRequirement: { findMany: vi.fn() },
    teamMemberAttribute: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => db);

import { resolveMissingAttributesForEnvironment } from "@/lib/domain/attribute-requirements";

const definition = (id: string, name: string) => ({
  id,
  festivalId: "fest-1",
  name,
  label: name,
  type: "TEXT",
  options: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("resolveMissingAttributesForEnvironment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only the required questions the member has not answered", async () => {
    db.prisma.environmentAttributeRequirement.findMany.mockResolvedValue([
      { environmentId: "env-1", definitionId: "d-gender", required: true, definition: definition("d-gender", "gender") },
      { environmentId: "env-1", definitionId: "d-drive", required: true, definition: definition("d-drive", "can_drive") },
    ]);
    db.prisma.teamMemberAttribute.findMany.mockResolvedValue([
      { memberId: "m1", definitionId: "d-gender", value: '"M"', definition: { name: "gender" } },
    ]);

    const missing = await resolveMissingAttributesForEnvironment("m1", "env-1");

    expect(missing.map((d) => d.name)).toEqual(["can_drive"]);
  });

  it("returns nothing when every required question is answered", async () => {
    db.prisma.environmentAttributeRequirement.findMany.mockResolvedValue([
      { environmentId: "env-1", definitionId: "d-drive", required: true, definition: definition("d-drive", "can_drive") },
    ]);
    db.prisma.teamMemberAttribute.findMany.mockResolvedValue([
      { memberId: "m1", definitionId: "d-drive", value: "true", definition: { name: "can_drive" } },
    ]);

    expect(await resolveMissingAttributesForEnvironment("m1", "env-1")).toEqual([]);
  });

  it("never asks an optional question", async () => {
    db.prisma.environmentAttributeRequirement.findMany.mockResolvedValue([
      { environmentId: "env-1", definitionId: "d-drive", required: false, definition: definition("d-drive", "can_drive") },
    ]);
    db.prisma.teamMemberAttribute.findMany.mockResolvedValue([]);

    expect(await resolveMissingAttributesForEnvironment("m1", "env-1")).toEqual([]);
  });
});
