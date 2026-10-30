import { describe, it, expect } from "vitest";
import { createFestivalSchema, updateFestivalSchema } from "@/lib/validations/festival";

const ok = { name: "Starlight", startDate: "2026-06-20", endDate: "2026-06-24" };

describe("createFestivalSchema", () => {
  it("accepts a valid festival", () => expect(createFestivalSchema.safeParse(ok).success).toBe(true));
  it("accepts a one-day festival", () =>
    expect(createFestivalSchema.safeParse({ ...ok, endDate: ok.startDate }).success).toBe(true));
  it.each(["", "   "])("rejects name %j", (name) => {
    const r = createFestivalSchema.safeParse({ ...ok, name });
    expect(r.success).toBe(false);
    expect(r.error!.errors[0].message).toBe("Festival name is required");
  });
  it("trims the name", () =>
    expect(createFestivalSchema.parse({ ...ok, name: "  Starlight  " }).name).toBe("Starlight"));
  it("rejects end before start", () => {
    const r = createFestivalSchema.safeParse({ ...ok, endDate: "2026-06-19" });
    expect(r.error!.errors[0].message).toBe("End date must be after start date");
  });
  it("rejects an unparseable date", () =>
    expect(createFestivalSchema.safeParse({ ...ok, startDate: "soon" }).success).toBe(false));
});

describe("updateFestivalSchema", () => {
  it("accepts a name-only change", () => expect(updateFestivalSchema.safeParse({ name: "New" }).success).toBe(true));
  it("rejects end before start when both are given", () =>
    expect(updateFestivalSchema.safeParse({ startDate: "2026-06-20", endDate: "2026-06-19" }).success).toBe(false));
});
