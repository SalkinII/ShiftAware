/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MarkerNode } from "../MarkerNode";

let capturedResizerProps: any;
vi.mock("@xyflow/react", () => ({
  NodeResizer: (props: any) => {
    capturedResizerProps = props;
    return null;
  },
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
    expect(screen.queryByLabelText("Delete marker")).not.toBeInTheDocument();
  });

  it("confirms before deleting, and does not delete when the confirm is dismissed", () => {
    const data = { ...baseData, onDelete: vi.fn() };
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    render(<MarkerNode {...({ id: "marker-m1", data, selected: false } as any)} />);
    fireEvent.click(screen.getByLabelText("Delete marker"));
    expect(window.confirm).toHaveBeenCalledWith("Delete this note?");
    expect(data.onDelete).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("deletes when the confirm is accepted", () => {
    const data = { ...baseData, onDelete: vi.fn() };
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    render(<MarkerNode {...({ id: "marker-m1", data, selected: false } as any)} />);
    fireEvent.click(screen.getByLabelText("Delete marker"));
    expect(data.onDelete).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("wires NodeResizer's onResizeEnd through to data.onResizeEnd", () => {
    const onResizeEnd = vi.fn();
    render(<MarkerNode {...({ id: "marker-m1", data: { ...baseData, onResizeEnd }, selected: true } as any)} />);
    capturedResizerProps.onResizeEnd({}, { width: 300 });
    expect(onResizeEnd).toHaveBeenCalledWith({}, { width: 300 });
  });

  it("does not render NodeResizer when readOnly", () => {
    capturedResizerProps = undefined;
    render(<MarkerNode {...({ id: "marker-m1", data: { ...baseData, readOnly: true }, selected: true } as any)} />);
    expect(capturedResizerProps).toBeUndefined();
  });
});
