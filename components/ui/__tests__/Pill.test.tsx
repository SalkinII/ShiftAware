/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Pill } from "../Pill";

describe("Pill", () => {
  it("applies the tone's background/text/border classes", () => {
    render(<Pill tone="amber">Test</Pill>);
    const el = screen.getByText("Test");
    expect(el.className).toMatch(/bg-amber-50/);
    expect(el.className).toMatch(/text-amber-700/);
  });

  it("calls onClick when clickable", () => {
    const onClick = vi.fn();
    render(<Pill tone="sky" onClick={onClick}>Click me</Pill>);
    fireEvent.click(screen.getByText("Click me"));
    expect(onClick).toHaveBeenCalled();
  });
});
