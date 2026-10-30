/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EnvironmentSettings } from "@/app/admin/setup/components/EnvironmentSettings";

const ctx = vi.hoisted(() => ({
  selectedEnvironmentId: null as string | null,
  environments: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/contexts/EnvironmentContext", () => ({
  useEnvironmentContext: () => ({
    selectedEnvironmentId: ctx.selectedEnvironmentId,
    selectedEnvironment: ctx.environments[0] ?? null,
    environments: ctx.environments,
    loading: false,
    refreshEnvironments: vi.fn(),
    setSelectedEnvironmentId: vi.fn(),
  }),
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/components/ui/ConfirmDialog", () => ({ ConfirmDialog: () => null }));

const bar = {
  id: "env-bar",
  name: "Bar",
  festivalId: "fest-1",
  status: "PLANNING",
  startDate: "2026-07-01T00:00:00.000Z",
  endDate: "2026-07-03T00:00:00.000Z",
};

describe("EnvironmentSettings", () => {
  beforeEach(() => {
    ctx.selectedEnvironmentId = null;
    ctx.environments = [];
  });

  it("labels the submit button Create Environment while creating one", () => {
    render(<EnvironmentSettings festivalId="fest-1" />);

    fireEvent.click(screen.getByRole("button", { name: "+ New Environment" }));

    expect(screen.getByRole("button", { name: "Create Environment" })).toBeTruthy();
  });

  it("links the selected environment to its attribute questions", () => {
    ctx.selectedEnvironmentId = "env-bar";
    ctx.environments = [bar];
    render(<EnvironmentSettings festivalId="fest-1" />);

    const link = screen.getByRole("link", { name: "Manage attribute questions" });

    expect(link.getAttribute("href")).toBe("/admin/environments/env-bar/attributes");
  });
});
