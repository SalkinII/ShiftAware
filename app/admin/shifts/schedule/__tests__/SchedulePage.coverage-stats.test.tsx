/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/dynamic", () => ({
  default: (_fn: unknown) => () => <div data-testid="lane-canvas" />,
}));
vi.mock("@/lib/hooks/useEventContext", () => ({
  useEventContext: () => ({
    selectedEventId: "evt-1",
    selectedEvent: {
      id: "evt-1",
      name: "Test Event",
      status: "FINALIZED",
      startDate: "2026-06-01T00:00:00Z",
      endDate: "2026-06-05T00:00:00Z",
    },
    refreshEvents: vi.fn(),
  }),
}));

const mockShift = {
  id: "s1",
  type: "GENERAL",
  startTime: "2026-06-01T08:00:00Z",
  endTime: "2026-06-01T14:00:00Z",
  durationMinutes: 360,
  priority: "NORMAL",
  desirabilityScore: 3,
  capacity: 2,
  eventId: "evt-1",
  event: { id: "evt-1", name: "Test Event" },
  requiredRoles: [],
  assignments: [],
  template: null,
};

// Returns shift data for the shifts cache key; empty for everything else.
// Stable array reference is required — a new [] on every call would trigger
// infinite re-renders via the cachedShifts → setShifts → re-render cycle.
const shiftsData = [mockShift];
vi.mock("@/lib/cache/useCache", () => {
  const empty: never[] = [];
  const refetch = vi.fn();
  return {
    useCache: ({ key }: { key: string }) =>
      key.startsWith("shifts-")
        ? { data: shiftsData, loading: false, error: null, refetch }
        : { data: empty, loading: false, error: null, refetch },
  };
});
vi.mock("@/lib/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/components/ui/ConfirmDialog", () => ({ ConfirmDialog: () => null }));
vi.mock("@/components/ui/Popover", () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/features/TemplatePalette/TemplatePalette", () => ({
  TemplatePalette: () => null,
}));
vi.mock(
  "@/components/features/LaneCalendar/sidebar/ShiftPropertiesPanel",
  () => ({ ShiftPropertiesPanel: () => null }),
);
vi.mock("@/components/features/SwapRequestsPanel/SwapRequestsPanel", () => ({
  SwapRequestsPanel: () => null,
}));
vi.mock("@/lib/services/event-status-permissions", () => ({
  canMutateShifts: () => false,
  canShowSwapPanel: () => false,
}));
vi.mock("@/lib/validations/event-transition", () => ({
  getNextStatus: () => null,
  getPreviousStatus: () => null,
}));
vi.mock("@/lib/cache/utils", () => ({
  getShiftsCacheKey: (id: string) => `shifts-${id}`,
}));
vi.mock("@/lib/cache/invalidateEventCache", () => ({
  invalidateEventCache: vi.fn(),
}));
vi.mock("@/lib/types/lane", () => ({
  deriveLanesFromTemplates: () => [],
}));
vi.mock("@/lib/utils/shift-display", () => ({
  getShiftDisplayInfo: () => ({
    date: "Mon 1 Jun",
    timeRange: "08:00–14:00",
    assignedCount: 0,
    capacity: 2,
  }),
}));

import ShiftsPage from "../page";

describe("SchedulePage – coverage stats bar mobile layout", () => {
  it("stats bar has flex-wrap so coverage items reflow on 360px viewports", () => {
    render(<ShiftsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));

    const coverageLabel = screen.getByText("Coverage");
    const statsBar = coverageLabel.parentElement!;
    expect(statsBar.className).toContain("flex-wrap");
  });
});
