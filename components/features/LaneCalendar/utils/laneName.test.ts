import { describe, it, expect } from "vitest";
import { abbreviateLaneName } from "./laneName";

describe("abbreviateLaneName", () => {
  it("returns first word of multi-word name", () => {
    expect(abbreviateLaneName("Mobile North")).toBe("Mobile");
  });

  it("returns single-word name unchanged", () => {
    expect(abbreviateLaneName("Super")).toBe("Super");
  });

  it("returns first word of three-word name", () => {
    expect(abbreviateLaneName("Shift Lead North")).toBe("Shift");
  });

  it("handles empty string", () => {
    expect(abbreviateLaneName("")).toBe("");
  });

  it("trims leading/trailing whitespace", () => {
    expect(abbreviateLaneName("  Mobile North  ")).toBe("Mobile");
  });
});
