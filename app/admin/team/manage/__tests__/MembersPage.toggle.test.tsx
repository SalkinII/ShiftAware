/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/cache/useCache", () => ({
  useCache: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
}));
vi.mock("@/lib/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/components/ui/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
}));
vi.mock("@/components/features/AvailabilityHeatmap/AvailabilityHeatmap", () => ({
  AvailabilityHeatmap: () => <div data-testid="heatmap" />,
}));
vi.mock("@/components/features/Identity/ProfileDetailCard", () => ({
  ProfileDetailCard: () => null,
}));
vi.mock("jspdf", () => ({ default: vi.fn() }));
vi.mock("jspdf-autotable", () => ({ default: vi.fn() }));

import MembersPage from "../page";

describe("MembersPage – view toggle standard", () => {
  it("toggle container uses bg-gray-100 rounded-xl (not rounded-lg)", () => {
    render(<MembersPage />);
    const listBtn = screen.getByRole("button", { name: "List" });
    const container = listBtn.parentElement!;
    expect(container.className).toContain("rounded-xl");
    expect(container.className).not.toContain("rounded-lg");
  });

  it("active button has bg-white text-gray-900", () => {
    render(<MembersPage />);
    const listBtn = screen.getByRole("button", { name: "List" });
    // List is active by default
    expect(listBtn.className).toContain("bg-white");
    expect(listBtn.className).toContain("text-gray-900");
  });
});
