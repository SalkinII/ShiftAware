/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const toastError = vi.fn();

// The dynamic import must resolve to a forwardRef component so that the
// canvasRef passed by the page actually gets populated.
vi.mock("next/dynamic", () => ({
  default: (_fn: unknown) =>
    React.forwardRef((_props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        exportToPng: async () => null,
      }));
      return <div data-testid="lane-canvas" />;
    }),
}));
vi.mock("@/lib/hooks/useEventContext", () => {
  const selectedEvent = {
    id: "evt-1",
    name: "Test",
    status: "FINALIZED",
    startDate: "2026-06-01T00:00:00Z",
    endDate: "2026-06-05T00:00:00Z",
  };
  return {
    useEventContext: () => ({ selectedEventId: "evt-1", selectedEvent }),
  };
});
// Stable references prevent infinite render loops caused by effect deps on
// array identity. See memory: feedback_vitest_stable_mock_refs.md
vi.mock("@/lib/cache/useCache", () => {
  const data: never[] = [];
  const refetch = vi.fn();
  return { useCache: () => ({ data, loading: false, error: null, refetch }) };
});
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: toastError }),
}));
vi.mock("@/components/ui/Button", () => ({
  Button: ({ children, onClick, className }: any) => (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));
vi.mock("@/components/ui/Skeleton", () => ({
  Skeleton: () => null,
  SkeletonList: () => null,
}));
vi.mock(
  "@/components/features/ShiftPropertiesPanel/ShiftPreferencePanel",
  () => ({ ShiftPreferencePanel: () => null }),
);
vi.mock("@/lib/cache/invalidateEventCache", () => ({
  invalidateEventCache: vi.fn(),
}));
vi.mock("@/lib/types/lane", () => ({
  deriveLanesFromTemplates: () => [],
}));
vi.mock("@/lib/api-errors", () => ({
  unwrapApiResponse: (r: any) => r?.data ?? r,
}));
vi.mock("../components/MyShiftsList", () => ({
  MyShiftsList: () => <div data-testid="my-shifts-list" />,
}));
vi.mock("date-fns", () => ({ format: () => "" }));
vi.mock("lucide-react", () => ({
  Calendar: () => null,
  Download: () => null,
  RefreshCw: () => null,
  SlidersHorizontal: () => null,
}));

import UserCalendarPage from "../page";

describe("UserCalendarPage – PNG export", () => {
  beforeEach(() => {
    toastError.mockReset();
  });

  it("Export button is absent in My Shifts view (default)", () => {
    render(<UserCalendarPage />);
    expect(screen.queryByRole("button", { name: /export/i })).toBeNull();
  });

  it("Export button appears after switching to Full Schedule view", () => {
    render(<UserCalendarPage />);
    fireEvent.click(screen.getByRole("button", { name: /Full Schedule/i }));
    expect(
      screen.getByRole("button", { name: /export/i }),
    ).toBeInTheDocument();
  });

  it("shows console-hint toast when exportToPng returns null", async () => {
    render(<UserCalendarPage />);
    fireEvent.click(screen.getByRole("button", { name: /Full Schedule/i }));
    fireEvent.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/console/i),
      );
    });
  });
});
