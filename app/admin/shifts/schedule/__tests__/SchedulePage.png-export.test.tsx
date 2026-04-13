/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const toastError = vi.fn();

// Dynamic import replaced by a forwardRef stub that returns null from exportToPng
vi.mock("next/dynamic", () => ({
  default: (_fn: unknown) =>
    React.forwardRef(function MockLaneCanvas(_props: any, ref: any) {
      React.useImperativeHandle(ref, () => ({
        exportToPng: async () => null,
      }));
      return <div data-testid="lane-canvas" />;
    }),
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
vi.mock("@/lib/hooks/useKeyboardShortcuts", () => ({ useKeyboardShortcuts: vi.fn() }));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: toastError }),
}));
vi.mock("@/components/ui/ConfirmDialog", () => ({ ConfirmDialog: () => null }));
// Render both children AND content so the Export as PNG button is in the DOM
vi.mock("@/components/ui/Popover", () => ({
  Popover: ({ children, content }: any) => (
    <div>
      {children}
      {content}
    </div>
  ),
}));
vi.mock("@/components/features/TemplatePalette/TemplatePalette", () => ({ TemplatePalette: () => null }));
vi.mock("@/components/features/LaneCalendar/sidebar/ShiftPropertiesPanel", () => ({ ShiftPropertiesPanel: () => null }));
vi.mock("@/components/features/SwapRequestsPanel/SwapRequestsPanel", () => ({ SwapRequestsPanel: () => null }));
vi.mock("@/lib/services/event-status-permissions", () => ({ canMutateShifts: () => true, canShowSwapPanel: () => false }));
vi.mock("@/lib/validations/event-transition", () => ({ getNextStatus: () => null, getPreviousStatus: () => null }));
vi.mock("@/lib/cache/utils", () => ({ getShiftsCacheKey: (id: string) => `shifts-${id}` }));
vi.mock("@/lib/cache/invalidateEventCache", () => ({ invalidateEventCache: vi.fn() }));
vi.mock("@/lib/types/lane", () => ({ deriveLanesFromTemplates: () => [] }));
vi.mock("@/lib/utils/shift-display", () => ({ getShiftDisplayInfo: () => ({ date: "", timeRange: "", assignedCount: 0, capacity: 0 }) }));

import ShiftsPage from "../page";

describe("SchedulePage – PNG export error message", () => {
  beforeEach(() => {
    toastError.mockReset();
  });

  it("shows console-hint toast when exportToPng returns null", async () => {
    render(<ShiftsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));

    const pngBtn = screen.getByText("Export as PNG");
    fireEvent.click(pngBtn);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/console/i));
    });
  });
});
