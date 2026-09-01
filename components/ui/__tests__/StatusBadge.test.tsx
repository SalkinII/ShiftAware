/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBadge } from "../StatusBadge";

describe("StatusBadge", () => {
  it("renders PLANNING with the gray tone and label unchanged after the Pill refactor", () => {
    render(<StatusBadge status="PLANNING" />);
    const badge = screen.getByText("Planning");
    const container = badge.closest("div");
    expect(container?.className).toMatch(/bg-gray-50/);
    expect(container?.className).toMatch(/text-gray-700/);
    expect(container?.className).toMatch(/border-gray-200/);
    expect(container?.querySelector(".bg-gray-500")).not.toBeNull();
  });
});
