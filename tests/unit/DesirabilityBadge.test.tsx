/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { DesirabilityBadge } from "@/components/ui/DesirabilityBadge";

describe("DesirabilityBadge", () => {
  it("renders integer score, not decimal", () => {
    render(<DesirabilityBadge score={3} />);
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.queryByText("3.0")).toBeNull();
  });

  it("renders + characters equal to score", () => {
    render(<DesirabilityBadge score={4} />);
    expect(screen.getByText("++++")).toBeTruthy();
  });

  it("applies blue colour for score <= 2", () => {
    const { container } = render(<DesirabilityBadge score={2} />);
    expect(container.firstChild).toHaveClass("bg-blue-50");
  });

  it("applies gray colour for score = 3", () => {
    const { container } = render(<DesirabilityBadge score={3} />);
    expect(container.firstChild).toHaveClass("bg-gray-100");
  });

  it("applies orange colour for score >= 4", () => {
    const { container } = render(<DesirabilityBadge score={5} />);
    expect(container.firstChild).toHaveClass("bg-orange-50");
  });
});
