/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  EnvironmentSelectionStep,
  resolveEntryRoute,
} from "@/app/(routes)/app/identity/components/EnvironmentSelectionStep";

vi.mock("@/lib/contexts/EnvironmentContext", () => ({
  useEnvironmentContext: () => ({ environments: [], loading: false }),
}));

describe("entry routing", () => {
  it("routes to 'none' when there are no registrations and nothing to join (empty production)", () => {
    expect(resolveEntryRoute([], 0)).toEqual({ type: "none" });
  });

  it("routes straight through with 0 registrations to the join flow", () => {
    expect(resolveEntryRoute([], 1)).toEqual({ type: "join" });
  });

  it("routes straight to shifts with exactly 1 registration, regardless of festival count", () => {
    const registrations = [{ environmentId: "env-1", festivalId: "fest-1" }];
    expect(resolveEntryRoute(registrations, 1)).toEqual({ type: "direct", environmentId: "env-1" });
  });

  it("routes to the picker with more than 1 registration, grouped by festival", () => {
    const registrations = [
      { environmentId: "env-1", festivalId: "fest-1" },
      { environmentId: "env-2", festivalId: "fest-2" },
    ];
    expect(resolveEntryRoute(registrations, 2).type).toBe("picker");
  });
});

describe("EnvironmentSelectionStep", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => (url.startsWith("/api/festivals") ? { data: [] } : { data: { environmentRegistrations: [] } }),
    })) as any;
  });

  it("renders 'No festival yet' and no join button when there is nothing to join", async () => {
    render(<EnvironmentSelectionStep memberId="m1" onEnvironmentSelected={vi.fn()} onBack={vi.fn()} />);

    expect(await screen.findByText("No festival yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /join|register/i })).toBeNull();
  });
});
