import { describe, it, expect } from "vitest";
import { updateEventSchema } from "@/lib/validations/event";

describe("updateEventSchema", () => {
  it("accepts valid partial update with only name", () => {
    const result = updateEventSchema.safeParse({
      id: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      name: "Updated Event",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid update with both dates in correct order", () => {
    const result = updateEventSchema.safeParse({
      id: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      startDate: "2026-06-01",
      endDate: "2026-06-03",
    });
    expect(result.success).toBe(true);
  });

  it("rejects update where endDate is before startDate", () => {
    const result = updateEventSchema.safeParse({
      id: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      startDate: "2026-06-05",
      endDate: "2026-06-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("endDate");
    }
  });

  it("accepts update with only startDate (no cross-field check needed)", () => {
    const result = updateEventSchema.safeParse({
      id: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      startDate: "2026-06-05",
    });
    expect(result.success).toBe(true);
  });

  it("requires a valid cuid id", () => {
    const result = updateEventSchema.safeParse({
      id: "not-a-cuid",
      name: "Test",
    });
    expect(result.success).toBe(false);
  });
});
