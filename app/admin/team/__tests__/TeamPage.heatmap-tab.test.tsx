/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Capture eventId prop passed to heatmap
let lastHeatmapEventId: string | undefined;

vi.mock("@/lib/hooks/useEventContext", () => ({
  useEventContext: () => ({
    selectedEventId: "event-1",
    selectedEvent: { id: "event-1", name: "Test Event" },
  }),
}));

vi.mock("@/components/features/AvailabilityHeatmap/AvailabilityHeatmap", () => ({
  AvailabilityHeatmap: ({ eventId }: { eventId?: string }) => {
    lastHeatmapEventId = eventId;
    return <div data-testid="availability-heatmap">Heatmap</div>;
  },
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
  beforeEach(() => {
    lastHeatmapEventId = undefined;
  });

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

describe("TeamPage – heatmap receives selectedEventId", () => {
  beforeEach(() => {
    lastHeatmapEventId = undefined;
  });

  it("passes selectedEventId as eventId prop to AvailabilityHeatmap", () => {
    render(<TeamPage />);
    fireEvent.click(screen.getByText("Availability Heatmap"));
    expect(lastHeatmapEventId).toBe("event-1");
  });
});
