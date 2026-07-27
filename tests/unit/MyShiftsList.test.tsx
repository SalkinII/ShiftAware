/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { MyShiftsList } from "@/app/(routes)/app/calendar/components/MyShiftsList";

const baseShift = {
  id: "shift-1",
  type: "MOBILE_TEAM",
  template: { id: "tmpl-1", name: "Mobile" },
  startTime: "2026-06-21T08:00:00.000Z",
  endTime: "2026-06-21T16:00:00.000Z",
  priority: "CORE",
  capacity: 4,
  assignments: [
    {
      id: "assign-1",
      role: "TEAM_MEMBER",
      assignmentType: "ALGORITHM",
      teamMember: { id: "user-1", alias: "Bear", avatarId: "🐻" },
    },
  ],
  event: { name: "Test Event", id: "event-1" },
};

const baseProps = {
  shifts: [baseShift],
  userId: "user-1",
  teamMemberId: "user-1",
  eventStatus: "PUBLISHED",
  preferences: [],
  onVoteWant: vi.fn(),
  onVoteNeutral: vi.fn(),
  onVoteDontWant: vi.fn(),
  onRequestSwap: vi.fn(),
  onCancelSwap: vi.fn(),
  swapRequests: [],
};

describe("MyShiftsList swap request states", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows Request Swap button when no active swap request", () => {
    render(<MyShiftsList {...baseProps} />);
    expect(screen.getByText("Request Swap")).toBeTruthy();
  });

  it("shows PENDING badge and Cancel button instead of Request Swap", () => {
    render(
      <MyShiftsList
        {...baseProps}
        swapRequests={[
          { id: "req-1", fromAssignmentId: "assign-1", status: "PENDING" },
        ]}
      />,
    );
    expect(screen.queryByText("Request Swap")).toBeNull();
    expect(screen.getByText(/pending/i)).toBeTruthy();
    expect(screen.getByText(/cancel/i)).toBeTruthy();
  });

  it("shows MATCHED badge without Cancel button", () => {
    render(
      <MyShiftsList
        {...baseProps}
        swapRequests={[
          { id: "req-1", fromAssignmentId: "assign-1", status: "MATCHED" },
        ]}
      />,
    );
    expect(screen.queryByText("Request Swap")).toBeNull();
    expect(screen.queryByText(/cancel/i)).toBeNull();
    expect(screen.getByText(/matched/i)).toBeTruthy();
  });

  it("shows DECLINED badge and restores Request Swap button", () => {
    render(
      <MyShiftsList
        {...baseProps}
        swapRequests={[
          { id: "req-1", fromAssignmentId: "assign-1", status: "DECLINED" },
        ]}
      />,
    );
    expect(screen.getByText("Request Swap")).toBeTruthy();
    expect(screen.getByText(/declined/i)).toBeTruthy();
  });

  it("shows APPROVED badge ('Swap approved') on new shift, no Request Swap button", () => {
    render(
      <MyShiftsList
        {...baseProps}
        swapRequests={[
          { id: "req-1", fromAssignmentId: "assign-1", status: "APPROVED" },
        ]}
      />,
    );
    expect(screen.queryByText("Request Swap")).toBeNull();
    expect(screen.getByText(/swap approved/i)).toBeTruthy();
  });

  it("Cancel button calls onCancelSwap with the request id", () => {
    render(
      <MyShiftsList
        {...baseProps}
        swapRequests={[
          { id: "req-1", fromAssignmentId: "assign-1", status: "PENDING" },
        ]}
      />,
    );
    fireEvent.click(screen.getByText(/cancel/i));
    expect(baseProps.onCancelSwap).toHaveBeenCalledWith("req-1");
  });
});
