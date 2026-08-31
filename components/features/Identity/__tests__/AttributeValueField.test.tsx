/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AttributeValueField } from "../AttributeValueField";

const timeConstraintAttr = {
  id: "attr-1",
  name: "availability",
  label: "Availability",
  type: "TIME_CONSTRAINT" as const,
  options: [],
  required: false,
};

describe("AttributeValueField — TIME_CONSTRAINT", () => {
  it("adds an availability window row and reports the updated JSON shape", () => {
    const onChange = vi.fn();
    render(<AttributeValueField attr={timeConstraintAttr} value={undefined} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /add availability window/i }));

    expect(onChange).toHaveBeenCalledWith(
      expect.stringContaining('"availabilityWindows"'),
    );
    const parsed = JSON.parse(onChange.mock.calls[0][0]);
    expect(parsed.availabilityWindows).toHaveLength(1);
    expect(parsed.dailyBlackouts).toEqual([]);
  });

  it("adds a blackout row and reports the updated JSON shape", () => {
    const onChange = vi.fn();
    render(<AttributeValueField attr={timeConstraintAttr} value={undefined} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /add blackout/i }));

    const parsed = JSON.parse(onChange.mock.calls[0][0]);
    expect(parsed.dailyBlackouts).toHaveLength(1);
  });

  it("renders formatted read-only text instead of raw JSON", () => {
    const value = JSON.stringify({
      availabilityWindows: [{ arriveAfter: "2026-08-21T18:00:00Z", leaveBefore: "2026-08-22T09:00:00Z" }],
      dailyBlackouts: [{ date: "2026-08-21", startHour: 22, endHour: 6 }],
    });
    render(<AttributeValueField attr={timeConstraintAttr} value={value} readOnly />);

    expect(screen.queryByText(/availabilityWindows/)).not.toBeInTheDocument();
    expect(screen.getByText(/Aug 21/)).toBeInTheDocument();
  });
});

describe("AttributeValueField — existing types (regression)", () => {
  it("still renders a TEXT field the same as before", () => {
    const onChange = vi.fn();
    const textAttr = { id: "a2", name: "notes", label: "Notes", type: "TEXT" as const, options: [], required: false };
    render(<AttributeValueField attr={textAttr} value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello" } });
    expect(onChange).toHaveBeenCalledWith("hello");
  });
});
