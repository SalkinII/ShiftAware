/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/lib/hooks/useEventContext", () => ({
  useEventContext: () => ({
    selectedEventId: "event-1",
    selectedEvent: { id: "event-1", name: "Test Event" },
  }),
}));

vi.mock("@/components/features/AvailabilityHeatmap/AvailabilityHeatmap", () => ({
  AvailabilityHeatmap: () => <div data-testid="availability-heatmap">Heatmap</div>,
}));

vi.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

vi.mock("../components/DistributionSettings", () => ({
  DistributionSettings: () => <div>Distribution Settings</div>,
}));

vi.mock("../components/MemberListByEvent", () => ({
  MemberListByEvent: () => <div>Member List</div>,
}));

import TeamPage from "../page";

describe("TeamPage – heatmap tab", () => {
  it("renders the Availability Heatmap tab button", () => {
    render(<TeamPage />);
    expect(screen.getByText("Availability Heatmap")).toBeInTheDocument();
  });

  it("shows AvailabilityHeatmap component when heatmap tab is clicked", () => {
    render(<TeamPage />);
    fireEvent.click(screen.getByText("Availability Heatmap"));
    expect(screen.getByTestId("availability-heatmap")).toBeInTheDocument();
  });
});
