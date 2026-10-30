import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    environmentRegistration: { findUnique: vi.fn(), findMany: vi.fn() },
    environmentAttributeRequirement: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => db);

import {
  getEnvironmentRegistrantIds,
  getVisibleAttributeDefinitionIds,
  isEnvironmentAdmin,
} from "@/lib/domain/environment-authorization";

describe("environment authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("isEnvironmentAdmin is true only for a registration with role ADMIN in that environment", async () => {
    db.prisma.environmentRegistration.findUnique
      .mockResolvedValueOnce({ memberId: "admin-1", environmentId: "bar", role: "ADMIN" })
      .mockResolvedValueOnce({ memberId: "member-1", environmentId: "bar", role: "MEMBER" })
      .mockResolvedValueOnce(null);

    expect(await isEnvironmentAdmin("admin-1", "bar")).toBe(true);
    expect(await isEnvironmentAdmin("member-1", "bar")).toBe(false);
    expect(await isEnvironmentAdmin("stranger", "bar")).toBe(false);
    expect(db.prisma.environmentRegistration.findUnique).toHaveBeenCalledWith({
      where: { memberId_environmentId: { memberId: "admin-1", environmentId: "bar" } },
    });
  });

  it("getVisibleAttributeDefinitionIds returns only the definitions the environment requires", async () => {
    db.prisma.environmentAttributeRequirement.findMany.mockResolvedValue([{ definitionId: "can-drive" }]);

    expect(await getVisibleAttributeDefinitionIds("bar")).toEqual(["can-drive"]);
    expect(db.prisma.environmentAttributeRequirement.findMany).toHaveBeenCalledWith({
      where: { environmentId: "bar" },
      select: { definitionId: true },
    });
  });

  it("getEnvironmentRegistrantIds returns only the environment's registrants", async () => {
    db.prisma.environmentRegistration.findMany.mockResolvedValue([{ memberId: "inBar" }]);

    expect(await getEnvironmentRegistrantIds("bar")).toEqual(["inBar"]);
    expect(db.prisma.environmentRegistration.findMany).toHaveBeenCalledWith({
      where: { environmentId: "bar" },
      select: { memberId: true },
    });
  });
});
