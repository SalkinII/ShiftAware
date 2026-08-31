/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Button } from "../Button";

describe("Button — destructive variant", () => {
  it("uses white text on the destructive variant (readable on the now-real error-600 background)", () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole("button")).toHaveClass("text-white");
    expect(screen.getByRole("button")).not.toHaveClass("text-red-600");
  });
});
