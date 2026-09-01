/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// --- All vi.mock() calls must come before any imports of the mocked modules ---

vi.mock("next/dynamic", () => ({
  default: (_fn: unknown) => () => <div data-testid="lane-canvas" />,
}));
vi.mock("@/lib/contexts/EventContext", () => ({
  useEventContext: () => ({
    selectedEventId: "evt-1",
    selectedEvent: {
      id: "evt-1",
      name: "Test Event",
      status: "OPEN_FOR_PREFERENCES",
      startDate: "2026-06-01T00:00:00Z",
      endDate: "2026-06-05T00:00:00Z",
    },
    refreshEvents: vi.fn(),
  }),
}));
vi.mock("@/lib/cache/useCache", () => ({
  useCache: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
}));
vi.mock("@/lib/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
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
vi.mock("@/lib/domain/event-status", () => ({
  canMutateShifts: () => true,
  canShowSwapPanel: () => true,
}));
vi.mock("@/lib/validations/event-transition", () => ({
  getNextStatus: (status: string) => (status === "OPEN_FOR_PREFERENCES" ? "ASSIGNING" : null),
  getPreviousStatus: () => null,
}));
vi.mock("@/lib/cache/invalidateEventCache", () => ({
  getShiftsCacheKey: (id: string) => `shifts-${id}`,
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
vi.mock("@/components/features/SwapRequestsPanel/SwapRequestsPanel", () => ({
  SwapRequestsPanel: () => <div data-testid="swap-panel-inner" />,
}));

vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }),
);

import ShiftsPage from "../page";

describe("SchedulePage – status transition confirmation", () => {
  it("opens a ConfirmDialog instead of window.confirm when transitioning event status", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    render(<ShiftsPage />);

    fireEvent.click(screen.getByRole("button", { name: /close preferences/i }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/change the event workflow state/i)).toBeInTheDocument();
  });
});
