/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// --- All vi.mock() calls must come before any imports of the mocked modules ---

vi.mock("next/dynamic", () => ({
  default: (_fn: unknown) => () => <div data-testid="lane-canvas" />,
}));
vi.mock("@/lib/hooks/useEventContext", () => ({
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
vi.mock("@/lib/services/event-status-permissions", () => ({
  canMutateShifts: () => true,
  canShowSwapPanel: () => true,
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

// Stateful mock — captures the onHasRequests prop so tests can call it
let triggerHasRequests: ((has: boolean, count?: number) => void) | undefined;
vi.mock("@/components/features/SwapRequestsPanel/SwapRequestsPanel", () => ({
  SwapRequestsPanel: (props: {
    onHasRequests?: (has: boolean, count?: number) => void;
    eventId?: string;
    eventStatus?: string;
    onRefresh?: () => void;
  }) => {
    triggerHasRequests = props.onHasRequests;
    return <div data-testid="swap-panel-inner" />;
  },
}));

import ShiftsPage from "../page";

describe("SchedulePage – header view toggle", () => {
  it("renders text 'List' and 'Calendar' toggle buttons", () => {
    render(<ShiftsPage />);
    expect(screen.getByRole("button", { name: "List" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Calendar" })).toBeInTheDocument();
  });

  it("toggle container uses bg-gray-100 rounded-xl", () => {
    render(<ShiftsPage />);
    const listBtn = screen.getByRole("button", { name: "List" });
    const container = listBtn.parentElement!;
    expect(container.className).toContain("bg-gray-100");
    expect(container.className).toContain("rounded-xl");
  });
});

describe("SchedulePage – mobile swap drawer", () => {
  it("shows mobile badge after SwapRequestsPanel reports requests", async () => {
    render(<ShiftsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));
    act(() => {
      triggerHasRequests?.(true, 2);
    });
    expect(await screen.findByText(/2 swaps pending/)).toBeInTheDocument();
  });

  it("badge has lg:hidden class so it is hidden on desktop", async () => {
    render(<ShiftsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));
    act(() => {
      triggerHasRequests?.(true, 3);
    });
    const badge = await screen.findByText(/3 swaps pending/);
    expect(badge.closest("button")!.className).toContain("lg:hidden");
  });
});

describe("SchedulePage – header button row overflow", () => {
  it("action button container has flex-wrap so buttons reflow on narrow viewports", () => {
    render(<ShiftsPage />);
    const exportBtn = screen.getByRole("button", { name: /export/i });
    // Walk up to find the flex-wrap container enclosing all header action buttons
    const flexWrapContainer = exportBtn.closest('[class*="flex-wrap"]');
    expect(flexWrapContainer).not.toBeNull();
  });
});

describe("SchedulePage – canvas panel mobile layout", () => {
  it("canvas row has flex-col and lg:flex-row for responsive stacking", () => {
    render(<ShiftsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));
    const canvas = screen.getByTestId("lane-canvas");
    // canvas → flex-1 wrapper → canvas row div
    const row = canvas.parentElement!.parentElement!;
    expect(row.className).toContain("flex-col");
    expect(row.className).toContain("lg:flex-row");
  });
});
