/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MyShiftsList } from "../components/MyShiftsList";

const baseShift = {
  id: "s1",
  type: "MOBILE_TEAM",
  template: { id: "t1", name: "Bar Shift" },
  startTime: "2026-08-01T08:00:00Z",
  endTime: "2026-08-01T16:00:00Z",
  priority: "CORE",
  capacity: 4,
  assignments: [],
  event: { name: "Fest", id: "e1" },
};

const assignedShift = {
  ...baseShift,
  assignments: [
    {
      id: "a1",
      role: "TEAM_MEMBER",
      assignmentType: "ALGORITHM",
      teamMember: { id: "u1", alias: "Bear", avatarId: "🐻" },
    },
  ],
};

const baseProps = {
  shifts: [],
  userId: "u1",
  teamMemberId: "u1",
  preferences: [],
  eventStatus: "OPEN_FOR_PREFERENCES" as const,
  onVoteWant: vi.fn(),
  onVoteDontWant: vi.fn(),
  onVoteNeutral: vi.fn(),
  onRequestSwap: vi.fn(),
  onCancelSwap: vi.fn(),
  swapRequests: [],
};

describe("MyShiftsList — unified list", () => {
  it("shows assigned shift in the list", () => {
    render(<MyShiftsList {...baseProps} shifts={[assignedShift]} />);
    expect(screen.getByText("Bar Shift")).toBeInTheDocument();
  });

  it("shows a preference-only shift (not assigned)", () => {
    render(
      <MyShiftsList
        {...baseProps}
        shifts={[baseShift]}
        preferences={[
          {
            shiftId: "s1",
            wantLevel: "WANT",
            shift: { id: "s1", type: "MOBILE_TEAM", template: baseShift.template, startTime: baseShift.startTime, endTime: baseShift.endTime },
          },
        ]}
      />,
    );
    expect(screen.getByText("Bar Shift")).toBeInTheDocument();
  });

  it("hides preference-only shifts when eventStatus is FINALIZED", () => {
    render(
      <MyShiftsList
        {...baseProps}
        eventStatus="FINALIZED"
        shifts={[baseShift]}
        preferences={[
          {
            shiftId: "s1",
            wantLevel: "WANT",
            shift: { id: "s1", type: "MOBILE_TEAM", template: baseShift.template, startTime: baseShift.startTime, endTime: baseShift.endTime },
          },
        ]}
      />,
    );
    expect(screen.queryByText("Bar Shift")).not.toBeInTheDocument();
  });

  it("shows three-state toggle when eventStatus is OPEN_FOR_PREFERENCES", () => {
    render(<MyShiftsList {...baseProps} shifts={[assignedShift]} />);
    expect(screen.getByRole("button", { name: /neutral/i })).toBeInTheDocument();
  });

  it("hides three-state toggle when eventStatus is FINALIZED", () => {
    render(<MyShiftsList {...baseProps} eventStatus="FINALIZED" shifts={[assignedShift]} />);
    expect(screen.queryByRole("button", { name: /neutral/i })).not.toBeInTheDocument();
  });

  it("calls onVoteNeutral when Neutral is clicked", () => {
    const onVoteNeutral = vi.fn();
    render(<MyShiftsList {...baseProps} shifts={[assignedShift]} onVoteNeutral={onVoteNeutral} />);
    fireEvent.click(screen.getByRole("button", { name: /neutral/i }));
    expect(onVoteNeutral).toHaveBeenCalledWith("s1");
  });

  it("does not render two separate sections (My Assignments / My Preferences)", () => {
    render(<MyShiftsList {...baseProps} shifts={[assignedShift]} />);
    expect(screen.queryByText(/my assignments/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/my preferences/i)).not.toBeInTheDocument();
  });
});
