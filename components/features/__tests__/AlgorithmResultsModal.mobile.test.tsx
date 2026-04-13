/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));
vi.mock("@/components/ui/Button", () => ({
  Button: ({ children, onClick, className, variant, disabled }: any) => (
    <button onClick={onClick} className={className} disabled={disabled}>
      {children}
    </button>
  ),
}));

const mockResult = {
  assignments: [],
  violations: [],
  scores: {},
  explanations: {},
  ruleMatchSummaries: [],
  memberAliases: {},
  shiftCoverage: {},
};

import { AlgorithmResultsModal } from "../AlgorithmResultsModal";

describe("AlgorithmResultsModal – stat card labels", () => {
  it("Assignments label uses tracking-wide not tracking-widest", () => {
    render(<AlgorithmResultsModal result={mockResult} onClose={vi.fn()} />);
    const label = screen.getByText("Assignments");
    expect(label.className).not.toContain("tracking-widest");
    expect(label.className).toContain("tracking-wide");
  });

  it("Avg Score label uses tracking-wide not tracking-widest", () => {
    render(<AlgorithmResultsModal result={mockResult} onClose={vi.fn()} />);
    const label = screen.getByText("Avg Score");
    expect(label.className).not.toContain("tracking-widest");
    expect(label.className).toContain("tracking-wide");
  });

  it("Violations label uses tracking-wide not tracking-widest", () => {
    render(<AlgorithmResultsModal result={mockResult} onClose={vi.fn()} />);
    const label = screen.getByText("Violations");
    expect(label.className).not.toContain("tracking-widest");
    expect(label.className).toContain("tracking-wide");
  });
});
