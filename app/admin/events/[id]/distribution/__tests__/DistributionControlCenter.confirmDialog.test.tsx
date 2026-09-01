/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DistributionControlCenter } from "../components/DistributionControlCenter";

vi.mock("../components/DistributionHeatmap", () => ({
  DistributionHeatmap: () => null,
}));
vi.mock("../components/AnalysisTable", () => ({
  AnalysisTable: () => null,
}));

describe("DistributionControlCenter – run algorithm confirmation", () => {
  it("opens a ConfirmDialog instead of window.confirm when running the algorithm", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    render(
      <DistributionControlCenter eventId="evt-1" eventStatus="ASSIGNING" eventName="Test Event" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Run Algorithm" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/run algorithm and commit assignments/i)).toBeInTheDocument();
  });
});
