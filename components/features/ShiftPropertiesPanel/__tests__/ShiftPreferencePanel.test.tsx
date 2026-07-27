/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShiftPreferencePanel } from "../ShiftPreferencePanel";

describe("ShiftPreferencePanel", () => {
  const baseShift = {
    id: "s1",
    type: "STATIONARY",
    startTime: "2026-03-01T08:00:00Z",
    endTime: "2026-03-01T14:00:00Z",
    capacity: 3,
    assignmentCount: 1,
  };
  const baseProps = {
    shift: baseShift,
    teamMemberId: "m1",
    currentVote: null as "WANT" | "DONT_WANT" | null,
    onVoteWant: vi.fn(),
    onVoteDontWant: vi.fn(),
    onVoteNeutral: vi.fn(),
    onClose: vi.fn(),
  };

  it("displays templateName when provided", () => {
    render(<ShiftPreferencePanel {...baseProps} shift={{ ...baseShift, templateName: "Front Gate" }} />);
    expect(screen.getByText("Front Gate")).toBeInTheDocument();
  });

  it("falls back to formatted type when templateName is missing", () => {
    render(<ShiftPreferencePanel {...baseProps} />);
    expect(screen.getByText("STATIONARY")).toBeInTheDocument();
  });

  it("renders three vote buttons: Want, Neutral, Don't want", () => {
    render(<ShiftPreferencePanel {...baseProps} />);
    expect(screen.getByRole("button", { name: /^Want this shift$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /neutral/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /don't want/i })).toBeInTheDocument();
  });

  it("calls onVoteNeutral when Neutral button is clicked", () => {
    const onVoteNeutral = vi.fn();
    render(<ShiftPreferencePanel {...baseProps} onVoteNeutral={onVoteNeutral} />);
    fireEvent.click(screen.getByRole("button", { name: /neutral/i }));
    expect(onVoteNeutral).toHaveBeenCalledWith("s1");
  });

  it("highlights Want button when currentVote is WANT", () => {
    render(<ShiftPreferencePanel {...baseProps} currentVote="WANT" />);
    const wantBtn = screen.getByRole("button", { name: /^Want this shift$/i });
    expect(wantBtn.className).toMatch(/bg-green/);
  });

  it("highlights Don't want button when currentVote is DONT_WANT", () => {
    render(<ShiftPreferencePanel {...baseProps} currentVote="DONT_WANT" />);
    const dontWantBtn = screen.getByRole("button", { name: /don't want/i });
    expect(dontWantBtn.className).toMatch(/bg-red/);
  });

  it("highlights Neutral button when currentVote is null", () => {
    render(<ShiftPreferencePanel {...baseProps} currentVote={null} />);
    const neutralBtn = screen.getByRole("button", { name: /neutral/i });
    expect(neutralBtn.className).toMatch(/bg-gray/);
  });
});
