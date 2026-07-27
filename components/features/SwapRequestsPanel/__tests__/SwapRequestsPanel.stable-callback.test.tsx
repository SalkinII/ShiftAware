/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/components/ui/Card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/ui/Button", () => ({
  Button: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));
vi.mock("@/lib/domain/event-status", () => ({
  canShowSwapPanel: () => true,
}));
vi.mock("@/lib/api-errors", () => ({
  unwrapApiResponse: (d: any) => (d?.data !== undefined ? d.data : d),
}));

import { SwapRequestsPanel } from "../SwapRequestsPanel";

const mockRequest = {
  id: "r1",
  status: "PENDING",
  matchedWithId: null,
  requester: { alias: "Finch" },
  fromAssignment: {
    role: "TEAM_MEMBER",
    shift: {
      template: { name: "Mobile" },
      type: "MOBILE_TEAM",
      startTime: "2026-06-01T08:00:00Z",
      endTime: "2026-06-01T14:00:00Z",
    },
  },
  toShift: {
    template: { name: "Stationary" },
    type: "STATIONARY",
    startTime: "2026-06-02T08:00:00Z",
    endTime: "2026-06-02T14:00:00Z",
    capacity: 2,
    assignments: [],
  },
};

describe("SwapRequestsPanel – stable callback", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [mockRequest] }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not re-fetch when onHasRequests prop reference changes between renders", async () => {
    const { rerender } = render(
      <SwapRequestsPanel
        eventId="evt-1"
        eventStatus={"OPEN_FOR_PREFERENCES" as any}
        onHasRequests={() => {}}
      />,
    );

    // Wait for the initial fetch to complete
    await vi.waitFor(() =>
      expect(global.fetch).toHaveBeenCalledTimes(1),
    );

    // Re-render with a brand new onHasRequests arrow function (simulates unstable parent)
    rerender(
      <SwapRequestsPanel
        eventId="evt-1"
        eventStatus={"OPEN_FOR_PREFERENCES" as any}
        onHasRequests={() => {}}
      />,
    );

    // Allow any pending microtasks to flush
    await new Promise((r) => setTimeout(r, 20));

    // Must still be exactly 1 — the new function reference must NOT have caused a re-fetch
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
