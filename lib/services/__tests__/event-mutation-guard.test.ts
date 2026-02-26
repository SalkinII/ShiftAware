import { describe, it, expect } from "vitest";
import { PERMISSION_MAP, canMutateEvent } from "../event-status-permissions";

describe("EVENT_MUTATE guard", () => {
  it("allows event mutation only in PLANNING status", () => {
    expect(PERMISSION_MAP.PLANNING.EVENT_MUTATE).toBe(true);
    expect(PERMISSION_MAP.OPEN_FOR_PREFERENCES.EVENT_MUTATE).toBe(false);
    expect(PERMISSION_MAP.ASSIGNING.EVENT_MUTATE).toBe(false);
    expect(PERMISSION_MAP.FINALIZED.EVENT_MUTATE).toBe(false);
    expect(PERMISSION_MAP.COMPLETED.EVENT_MUTATE).toBe(false);
  });

  it("canMutateEvent returns true only for PLANNING", () => {
    expect(canMutateEvent("PLANNING" as any)).toBe(true);
    expect(canMutateEvent("ASSIGNING" as any)).toBe(false);
  });
});
