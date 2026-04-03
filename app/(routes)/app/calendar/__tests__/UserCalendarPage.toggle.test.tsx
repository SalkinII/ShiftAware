/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/dynamic", () => ({
  default: (_fn: unknown) => () => <div data-testid="lane-canvas" />,
}));
vi.mock("@/lib/hooks/useEventContext", () => {
  const selectedEvent = {
    id: "evt-1",
    name: "Test",
    status: "OPEN_FOR_PREFERENCES",
    startDate: "2026-06-01T00:00:00Z",
    endDate: "2026-06-05T00:00:00Z",
  };
  return {
    useEventContext: () => ({ selectedEventId: "evt-1", selectedEvent }),
  };
});
vi.mock("@/lib/cache/useCache", () => {
  // Stable references prevent infinite render loops: React bails out when state
  // reference is unchanged, but a new [] on every render would re-trigger
  // the cachedShifts effect → setShifts → re-render → repeat → OOM.
  const data: never[] = [];
  const refetch = vi.fn();
  return {
    useCache: () => ({ data, loading: false, error: null, refetch }),
  };
});
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
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
vi.mock("@/components/features/ShiftPropertiesPanel/ShiftPreferencePanel", () => ({
  ShiftPreferencePanel: () => null,
}));
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
vi.mock("date-fns", () => ({
  format: () => "",
}));
vi.mock("lucide-react", () => ({
  Calendar: () => null,
  RefreshCw: () => null,
  SlidersHorizontal: () => null,
}));

import UserCalendarPage from "../page";

describe("UserCalendarPage – view toggle standard", () => {
  it("toggle container uses bg-gray-100 (not bg-white with border)", () => {
    render(<UserCalendarPage />);
    const myShiftsBtn = screen.getByRole("button", { name: /My Shifts/i });
    const container = myShiftsBtn.parentElement!;
    expect(container.className).toContain("bg-gray-100");
    expect(container.className).not.toContain("border-gray-200");
  });

  it("active button uses bg-white text-gray-900 (not bg-primary-500 text-white)", () => {
    render(<UserCalendarPage />);
    const myShiftsBtn = screen.getByRole("button", { name: /My Shifts/i });
    // My Shifts is active by default
    expect(myShiftsBtn.className).toContain("bg-white");
    expect(myShiftsBtn.className).toContain("text-gray-900");
    expect(myShiftsBtn.className).not.toContain("bg-primary-500");
  });
});
