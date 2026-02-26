import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { invalidateEventCache, CacheScope } from "../invalidateEventCache";

describe("invalidateEventCache", () => {
  let dispatchSpy: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    dispatchSpy = vi.fn().mockReturnValue(true);
    vi.stubGlobal("window", {
      dispatchEvent: dispatchSpy,
      CustomEvent: class CustomEvent {
        type: string;
        detail: unknown;
        constructor(type: string, init?: { detail?: unknown }) {
          this.type = type;
          this.detail = init?.detail ?? {};
        }
      },
    } as unknown as Window);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    dispatchSpy.mockClear();
  });

  it("dispatches cache invalidation event with correct keys", () => {
    invalidateEventCache("ev1", "shifts", "assignments");

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "shiftaware:cache-invalidate",
        detail: {
          keys: [
            "shifts",
            "shifts:*",
            "shifts:event:ev1",
            "assignments",
            "assignments:*",
            "assignments:event:ev1",
          ],
        },
      }),
    );
  });

  it("supports all scope types", () => {
    const scopes: CacheScope[] = [
      "shifts",
      "assignments",
      "templates",
      "preferences",
      "registrations",
    ];
    invalidateEventCache("ev1", ...scopes);
    expect(dispatchSpy).toHaveBeenCalled();
  });
});
