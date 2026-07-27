/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

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
  unwrapApiResponse: (data: any) => (data?.data !== undefined ? data.data : data),
}));

// Card, Button, Input render their children so layout classes are visible
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
  Input: ({ label, value, onChange, type, min, max }: any) => (
    <div>
      <label>{label}</label>
      <input aria-label={label} type={type || "text"} value={value} onChange={onChange} min={min} max={max} />
    </div>
  ),
}));

const mockGlobalTemplate = {
  id: "tmpl-1",
  name: "Morning Shift",
  type: "MOBILE_TEAM",
  durationMinutes: 480,
  startTime: "08:00",
  priority: "CORE",
  capacity: 5,
};

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const urlStr = String(url);
    if (urlStr.includes("includeGlobal=false")) {
      return { ok: true, json: async () => ({ data: [] }) } as any;
    }
    if (urlStr.includes("/api/events/")) {
      return {
        ok: true,
        json: async () => ({ data: { assigned: [], eventSpecific: [] } }),
      } as any;
    }
    // global templates
    return { ok: true, json: async () => ({ data: [mockGlobalTemplate] }) } as any;
  });
});

import { TemplateManager } from "../TemplateManager";

describe("TemplateManager – mobile layout", () => {
  it("global template metadata row has flex-wrap so it does not overflow narrow cards", async () => {
    render(<TemplateManager />);
    await waitFor(() => screen.getByText("Morning Shift"));

    // The span containing "08:00" is inside the metadata div
    const timeSpan = screen.getByText(/08:00/);
    const metadataDiv = timeSpan.parentElement!;
    expect(metadataDiv.className).toContain("flex-wrap");
  });

  it("global template middle block has min-w-0 so it can shrink below content width", async () => {
    render(<TemplateManager />);
    await waitFor(() => screen.getByText("Morning Shift"));

    const nameEl = screen.getByText("Morning Shift");
    const middleBlock = nameEl.parentElement!;
    expect(middleBlock.className).toContain("min-w-0");
  });

  it("edit form grid uses sm:grid-cols-3 for responsive stacking on narrow screens", async () => {
    render(<TemplateManager />);
    // Open the new template form (wait for async loadTemplates to finish)
    const newBtn = await waitFor(() =>
      screen.getByRole("button", { name: /new template/i }),
    );
    fireEvent.click(newBtn);

    const startLabel = screen.getByText("Start Time");
    const gridDiv = startLabel.closest("[class*='grid']")!;
    expect(gridDiv.className).toContain("sm:grid-cols-3");
  });
});
