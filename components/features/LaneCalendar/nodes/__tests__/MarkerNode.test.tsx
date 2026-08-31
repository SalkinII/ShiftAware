/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MarkerNode } from "../MarkerNode";

vi.mock("@xyflow/react", () => ({
  NodeResizer: () => null,
}));

const baseData = { markerId: "m1", text: "Lunch break", onSave: vi.fn(), onDelete: vi.fn(), readOnly: false };

describe("MarkerNode", () => {
  it("enters inline edit mode on click and saves on blur", () => {
    render(<MarkerNode {...({ id: "marker-m1", data: baseData, selected: false } as any)} />);
    fireEvent.click(screen.getByText("Lunch break"));
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Updated note" } });
    fireEvent.blur(textarea);
    expect(baseData.onSave).toHaveBeenCalledWith("Updated note");
  });

  it("suppresses the delete button and textarea entry when readOnly", () => {
    render(<MarkerNode {...({ id: "marker-m1", data: { ...baseData, readOnly: true }, selected: false } as any)} />);
    fireEvent.click(screen.getByText("Lunch break"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
