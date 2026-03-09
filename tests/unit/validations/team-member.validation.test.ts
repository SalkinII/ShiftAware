import { describe, it, expect } from "vitest";
import { teamMemberSchema } from "@/lib/validations/team-member";

describe("teamMemberSchema", () => {
  it("accepts a body without experienceLevel and defaults to INTERMEDIATE", () => {
    const result = teamMemberSchema.parse({
      alias: "Otter",
      avatarId: "🦦",
      capabilities: ["TEAM_MEMBER"],
    });
    expect(result.experienceLevel).toBe("INTERMEDIATE");
  });

  it("still accepts an explicit experienceLevel", () => {
    const result = teamMemberSchema.parse({
      alias: "Wolf",
      avatarId: "🐺",
      capabilities: ["TEAM_MEMBER"],
      experienceLevel: "SENIOR",
    });
    expect(result.experienceLevel).toBe("SENIOR");
  });
});
