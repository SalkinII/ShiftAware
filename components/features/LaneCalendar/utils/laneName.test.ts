import { describe, it, expect } from "vitest";
import { abbreviateLaneName } from "./laneName";

describe("abbreviateLaneName", () => {
  it("returns initials for multi-word names", () => {
    expect(abbreviateLaneName("Mobile North")).toBe("MN");
  });

  it("returns first 3 chars for single-word names", () => {
    expect(abbreviateLaneName("Super")).toBe("Sup");
  });

  it("returns initials for three-word names", () => {
    expect(abbreviateLaneName("Shift Lead North")).toBe("SLN");
  });

  it("handles empty string", () => {
    expect(abbreviateLaneName("")).toBe("");
  });

  it("trims leading/trailing whitespace", () => {
    expect(abbreviateLaneName("  Mobile North  ")).toBe("MN");
  });
});
