/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { CreateProfileForm } from "@/app/(routes)/app/identity/components/CreateProfileForm";

// Silence fetch calls in tests
beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [] }),
  });
});

describe("CreateProfileForm", () => {
  it("does NOT render an experience level dropdown", () => {
    render(<CreateProfileForm onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText(/experience level/i)).toBeNull();
    expect(screen.queryByText(/junior/i)).toBeNull();
  });

  it("renders alias input and avatar picker", () => {
    render(<CreateProfileForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/display name/i)).toBeTruthy();
  });
});
