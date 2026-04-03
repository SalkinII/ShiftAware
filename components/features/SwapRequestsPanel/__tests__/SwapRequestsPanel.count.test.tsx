/**
 * @vitest-environment jsdom
 */
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
vi.mock("@/lib/services/event-status-permissions", () => ({
  canShowSwapPanel: () => true,
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

describe("SwapRequestsPanel – onHasRequests count", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [mockRequest] }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls onHasRequests with count=1 when one request exists", async () => {
    const onHasRequests = vi.fn();
    render(
      <SwapRequestsPanel
        eventId="evt-1"
        eventStatus={"OPEN_FOR_PREFERENCES" as any}
        onHasRequests={onHasRequests}
      />,
    );
    await vi.waitFor(() => {
      expect(onHasRequests).toHaveBeenCalledWith(true, 1);
    });
  });
});
