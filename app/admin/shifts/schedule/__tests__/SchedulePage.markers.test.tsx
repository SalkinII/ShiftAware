/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// --- All vi.mock() calls must come before any imports of the mocked modules ---

let capturedProps: any;
vi.mock("next/dynamic", () => ({
  default: (_fn: unknown) => (props: any) => {
    capturedProps = props;
    return <div data-testid="lane-canvas" />;
  },
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
  useCache: ({ key }: { key: string }) => {
    if (key.startsWith("markers-")) {
      return {
        data: [{ id: "m1", text: "x", startTime: "2026-06-01T08:00:00Z", endTime: "2026-06-01T08:30:00Z" }],
        loading: false,
        error: null,
        refetch: vi.fn(),
      };
    }
    return { data: [], loading: false, error: null, refetch: vi.fn() };
  },
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
  getNextStatus: () => null,
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

import ShiftsPage from "../page";

describe("SchedulePage – markers", () => {
  it("fetches markers for the selected event and passes them to the canvas", () => {
    render(<ShiftsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));

    expect(capturedProps.markers).toEqual([
      { id: "m1", text: "x", startTime: "2026-06-01T08:00:00Z", endTime: "2026-06-01T08:30:00Z" },
    ]);
  });
});
