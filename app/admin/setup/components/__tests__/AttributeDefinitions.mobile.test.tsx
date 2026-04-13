/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/hooks/useEventContext", () => ({
  useEventContext: () => ({
    selectedEventId: "event-1",
    selectedEvent: { id: "event-1", name: "Test Event" },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/api-errors", () => ({
  unwrapApiResponse: (d: any) => (d?.data !== undefined ? d.data : d),
}));
vi.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));
vi.mock("@/components/ui/Button", () => ({
  Button: ({ children, onClick, disabled, className, variant, size }: any) => (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));
vi.mock("@/components/ui/Input", () => ({
  Input: ({ label, value, onChange }: any) => (
    <div>
      <label>{label}</label>
      <input aria-label={label} value={value} onChange={onChange} />
    </div>
  ),
}));
vi.mock("@/components/ui/Select", () => ({
  Select: ({ label, children, value, onChange }: any) => (
    <div>
      <label>{label}</label>
      <select aria-label={label} value={value} onChange={onChange}>
        {children}
      </select>
    </div>
  ),
}));

const mockAttribute = {
  id: "attr-1",
  name: "can_drive",
  label: "Can Drive",
  type: "BOOLEAN",
  options: [],
  required: true,
};

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ data: [mockAttribute] }),
  } as any);
});

import { AttributeDefinitions } from "../AttributeDefinitions";

describe("AttributeDefinitions – mobile layout", () => {
  it("header has flex-wrap so event name badge doesn't overflow", async () => {
    render(<AttributeDefinitions />);
    await waitFor(() => screen.getByText("Can Drive"));

    const heading = screen.getByText("Team Attributes");
    const header = heading.parentElement!.parentElement!;
    expect(header.className).toContain("flex-wrap");
  });

  it("attribute card has flex-wrap so action icons don't overflow", async () => {
    render(<AttributeDefinitions />);
    await waitFor(() => screen.getByText("Can Drive"));

    const label = screen.getByText("Can Drive");
    const card = label.closest('[class*="flex-wrap"]');
    expect(card).not.toBeNull();
  });

  it("attribute card left block has min-w-0 so text can shrink", async () => {
    render(<AttributeDefinitions />);
    await waitFor(() => screen.getByText("Can Drive"));

    const label = screen.getByText("Can Drive");
    // After fix: label is a direct child of the min-w-0 left block (one level up, not two)
    const leftBlock = label.parentElement!;
    expect(leftBlock.className).toContain("min-w-0");
  });

  it("attribute label is a block element so it takes full width before badges", async () => {
    render(<AttributeDefinitions />);
    await waitFor(() => screen.getByText("Can Drive"));

    const label = screen.getByText("Can Drive");
    expect(label.tagName).toBe("P");
    expect(label.className).toContain("truncate");
  });

  it("badges row has flex-wrap so REQUIRED and type badges wrap on narrow screens", async () => {
    render(<AttributeDefinitions />);
    await waitFor(() => screen.getByText("Can Drive"));

    const typeTag = screen.getByText("BOOLEAN");
    const badgesRow = typeTag.parentElement!;
    expect(badgesRow.className).toContain("flex-wrap");
  });
});
