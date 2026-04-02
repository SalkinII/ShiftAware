/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/ui/GlassPanel", () => ({
  GlassPanel: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/components/features/Identity/ProfileDetailCard", () => ({
  ProfileDetailCard: () => null,
}));
vi.mock("@/lib/services/event-status-permissions", () => ({
  canManuallyAssign: () => false,
  canMutateShifts: () => false,
}));
vi.mock("@/components/ui/AvatarStack", () => ({
  AvatarStack: () => null,
}));
vi.mock("@/lib/utils/shift-display", () => ({
  getShiftDisplayInfo: () => ({
    date: "Mon 1 Jun",
    timeRange: "08:00–14:00",
    assignedCount: 0,
    capacity: 3,
  }),
}));

const mockShift = {
  id: "s1",
  type: "MOBILE_TEAM",
  startTime: "2026-06-01T08:00:00Z",
  endTime: "2026-06-01T14:00:00Z",
  capacity: 3,
  desirabilityScore: 3,
  template: { id: "t1", name: "Mobile", color: "#6b7280" },
  assignments: [],
  requiredRoles: [],
  preferences: [
    { wantLevel: "WANT", teamMember: { alias: "Bear", id: "m1" } },
    { wantLevel: "WANT", teamMember: { alias: "Fox", id: "m2" } },
    { wantLevel: "DONT_WANT", teamMember: { alias: "Robin", id: "m3" } },
  ],
};

import { ShiftPropertiesPanel } from "../ShiftPropertiesPanel";

describe("ShiftPropertiesPanel – preference alias pills", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockShift }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders want aliases as green pills", async () => {
    render(
      <ShiftPropertiesPanel
        shiftId="s1"
        eventStatus="PLANNING"
        onClose={vi.fn()}
        onUpdated={vi.fn()}
      />,
    );
    expect(await screen.findByText("Bear")).toBeInTheDocument();
    expect(screen.getByText("Fox")).toBeInTheDocument();
  });

  it("renders dont-want aliases as red pills", async () => {
    render(
      <ShiftPropertiesPanel
        shiftId="s1"
        eventStatus="PLANNING"
        onClose={vi.fn()}
        onUpdated={vi.fn()}
      />,
    );
    expect(await screen.findByText("Robin")).toBeInTheDocument();
  });

  it("does not show the old 'N people want/don't want' count text", async () => {
    render(
      <ShiftPropertiesPanel
        shiftId="s1"
        eventStatus="PLANNING"
        onClose={vi.fn()}
        onUpdated={vi.fn()}
      />,
    );
    await screen.findByText("Bear"); // wait for data
    expect(screen.queryByText(/people want/)).not.toBeInTheDocument();
    expect(screen.queryByText(/people don/)).not.toBeInTheDocument();
  });
});
