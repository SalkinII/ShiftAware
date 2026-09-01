/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("@/lib/contexts/EventContext", () => ({
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

describe("AttributeDefinitions – delete confirmation", () => {
  it("opens a ConfirmDialog instead of window.confirm when deleting an attribute", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    render(<AttributeDefinitions />);
    await waitFor(() => screen.getByText("Can Drive"));

    fireEvent.click(screen.getByRole("button", { name: /delete attribute/i }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/remove it from all team members/i)).toBeInTheDocument();
  });
});
