/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AddMarkerPill } from "../AddMarkerPill";

describe("AddMarkerPill", () => {
  it("sets the marker dataTransfer type on drag start", () => {
    render(<AddMarkerPill />);
    const pill = screen.getByText(/add note/i);
    const dataTransfer = { setData: vi.fn(), effectAllowed: "" };
    fireEvent.dragStart(pill, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith("application/shiftaware-marker", expect.any(String));
  });
});
