import { describe, it, expect } from "vitest";
import { abbreviateLaneName } from "@/components/features/LaneCalendar/utils/laneName";

describe("abbreviateLaneName", () => {
  it("returns empty string for empty input", () => {
    expect(abbreviateLaneName("")).toBe("");
    expect(abbreviateLaneName("   ")).toBe("");
  });

  it("returns initials for multi-word names", () => {
    expect(abbreviateLaneName("Mobile North")).toBe("MN");
    expect(abbreviateLaneName("Mobile South")).toBe("MS");
    expect(abbreviateLaneName("Shift Lead")).toBe("SL");
  });

  it("returns first 3 chars for single-word names", () => {
    expect(abbreviateLaneName("SUPER")).toBe("SUP");
    expect(abbreviateLaneName("Buffer")).toBe("Buf");
    expect(abbreviateLaneName("Stationary")).toBe("Sta");
  });

  it("handles short single words", () => {
    expect(abbreviateLaneName("AB")).toBe("AB");
    expect(abbreviateLaneName("X")).toBe("X");
  });

  it("handles three-word names", () => {
    expect(abbreviateLaneName("Extended Night Crew")).toBe("ENC");
  });
});
