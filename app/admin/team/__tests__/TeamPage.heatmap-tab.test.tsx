/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Capture props passed to the Distribution Control Center
let lastControlCenterProps: {
  eventId?: string;
  eventStatus?: string;
  eventName?: string;
} = {};

vi.mock("@/lib/contexts/EventContext", () => ({
  useEventContext: () => ({
    selectedEventId: "event-1",
    selectedEvent: { id: "event-1", name: "Test Event", status: "ASSIGNMENT" },
  }),
}));

vi.mock(
  "../../events/[id]/distribution/components/DistributionControlCenter",
  () => ({
    DistributionControlCenter: ({
      eventId,
      eventStatus,
      eventName,
    }: {
      eventId?: string;
      eventStatus?: string;
      eventName?: string;
    }) => {
      lastControlCenterProps = { eventId, eventStatus, eventName };
      return <div data-testid="distribution-control-center">Control Center</div>;
    },
  }),
);

vi.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

vi.mock("../components/DistributionSettings", () => ({
  DistributionSettings: () => <div>Distribution Settings</div>,
}));

vi.mock("../components/MemberListByEvent", () => ({
  MemberListByEvent: () => <div>Member List</div>,
}));

vi.mock("../components/MemberManagement", () => ({
  MemberManagement: () => <div data-testid="member-management">Member Management</div>,
}));

import TeamPage from "../page";

describe("TeamPage – heatmap tab", () => {
  beforeEach(() => {
    lastControlCenterProps = {};
  });

  it("renders the Availability Heatmap tab button", () => {
    render(<TeamPage />);
    expect(screen.getByText("Availability Heatmap")).toBeInTheDocument();
  });

  it("shows DistributionControlCenter when heatmap tab is clicked", () => {
    render(<TeamPage />);
    fireEvent.click(screen.getByText("Availability Heatmap"));
    expect(screen.getByTestId("distribution-control-center")).toBeInTheDocument();
  });
});

describe("TeamPage – control center receives event context", () => {
  beforeEach(() => {
    lastControlCenterProps = {};
  });

  it("passes selectedEventId, selectedEvent.status, and selectedEvent.name to DistributionControlCenter", () => {
    render(<TeamPage />);
    fireEvent.click(screen.getByText("Availability Heatmap"));
    expect(lastControlCenterProps).toEqual({
      eventId: "event-1",
      eventStatus: "ASSIGNMENT",
      eventName: "Test Event",
    });
  });
});

describe("TeamPage – Member Directory tab", () => {
  it("renders the Member Directory tab button", () => {
    render(<TeamPage />);
    expect(screen.getByText("Member Directory")).toBeInTheDocument();
  });

  it("shows MemberManagement when Member Directory tab is clicked", () => {
    render(<TeamPage />);
    fireEvent.click(screen.getByText("Member Directory"));
    expect(screen.getByTestId("member-management")).toBeInTheDocument();
  });

  it("renames the event-scoped tab to Event Members", () => {
    render(<TeamPage />);
    expect(screen.getByText("Event Members")).toBeInTheDocument();
    expect(screen.queryByText("Team Members")).not.toBeInTheDocument();
  });
});
