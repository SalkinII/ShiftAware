/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("displays templateName when provided", () => {
    render(
      <ShiftPreferencePanel
        shift={{ ...baseShift, templateName: "Front Gate" }}
        onVoteWant={() => {}}
        onVoteDontWant={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Front Gate")).toBeInTheDocument();
    expect(screen.queryByText("STATIONARY")).not.toBeInTheDocument();
  });

  it("falls back to formatted type when templateName is missing", () => {
    render(
      <ShiftPreferencePanel
        shift={baseShift}
        onVoteWant={() => {}}
        onVoteDontWant={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("STATIONARY")).toBeInTheDocument();
  });
});
