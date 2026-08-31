import { describe, it, expect } from "vitest";
import { markerSchema, updateMarkerSchema } from "@/lib/validations/marker";

describe("markerSchema", () => {
  it("accepts an empty text value", () => {
    const result = markerSchema.safeParse({
      eventId: "clabc0000000000000000000",
      text: "",
      startTime: "2026-08-01T08:00:00.000Z",
      endTime: "2026-08-01T08:30:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects endTime before startTime", () => {
    const result = markerSchema.safeParse({
      eventId: "clabc0000000000000000000",
      text: "Lunch break",
      startTime: "2026-08-01T08:30:00.000Z",
      endTime: "2026-08-01T08:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateMarkerSchema", () => {
  it("accepts a partial update with just text", () => {
    const result = updateMarkerSchema.safeParse({ id: "clabc0000000000000000000", text: "Updated note" });
    expect(result.success).toBe(true);
  });
});
