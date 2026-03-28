/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Toast
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import { SwapRequestsPanel } from "@/components/features/SwapRequestsPanel/SwapRequestsPanel";

const mockRequests = [
  {
    id: "req-1",
    status: "PENDING",
    matchedWithId: null,
    requester: { alias: "Bear" },
    fromAssignment: {
      role: "TEAM_MEMBER",
      shift: {
        template: { name: "Mobile" },
        type: "MOBILE_TEAM",
        startTime: "2026-06-21T08:00:00.000Z",
        endTime: "2026-06-21T16:00:00.000Z",
      },
    },
    toShift: {
      template: { name: "Supervision" },
      type: "STATIONARY",
      startTime: "2026-06-21T16:00:00.000Z",
      endTime: "2026-06-22T00:00:00.000Z",
      capacity: 4,
      assignments: [{ id: "a1" }, { id: "a2" }],
    },
  },
  {
    id: "req-2",
    status: "MATCHED",
    matchedWithId: "req-3", // canonical side — has matchedWithId set
    requester: { alias: "Fox" },
    fromAssignment: {
      role: "TEAM_LEAD",
      shift: {
        template: null,
        type: "SUPER",
        startTime: "2026-06-22T08:00:00.000Z",
        endTime: "2026-06-22T16:00:00.000Z",
      },
    },
    toShift: {
      template: { name: "Mobile" },
      type: "MOBILE_TEAM",
      startTime: "2026-06-22T16:00:00.000Z",
      endTime: "2026-06-23T00:00:00.000Z",
      capacity: 3,
      assignments: [],
    },
  },
  {
    id: "req-3",
    status: "MATCHED",
    matchedWithId: null, // matchedBy side — should NOT be shown
    requester: { alias: "Owl" },
    fromAssignment: {
      role: "TEAM_MEMBER",
      shift: {
        template: { name: "Mobile" },
        type: "MOBILE_TEAM",
        startTime: "2026-06-22T16:00:00.000Z",
        endTime: "2026-06-23T00:00:00.000Z",
      },
    },
    toShift: {
      template: null,
      type: "SUPER",
      startTime: "2026-06-22T08:00:00.000Z",
      endTime: "2026-06-22T16:00:00.000Z",
      capacity: 2,
      assignments: [{ id: "b1" }],
    },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ data: mockRequests }),
  });
});

describe("SwapRequestsPanel", () => {
  it("renders request cards with requester alias", async () => {
    render(<SwapRequestsPanel eventId="event-1" />);
    await waitFor(() => expect(screen.getByText("Bear")).toBeTruthy());
    expect(screen.getByText("Fox")).toBeTruthy();
  });

  it("renders from/to shift names", async () => {
    render(<SwapRequestsPanel eventId="event-1" />);
    await waitFor(() =>
      expect(
        screen.getAllByText("Mobile", { exact: false }).length,
      ).toBeGreaterThan(0),
    );
    expect(
      screen.getAllByText("Supervision", { exact: false }).length,
    ).toBeGreaterThan(0);
  });

  it("shows PENDING badge on first request", async () => {
    render(<SwapRequestsPanel eventId="event-1" />);
    await waitFor(() => expect(screen.getByText(/pending/i)).toBeTruthy());
  });

  it("shows MATCHED badge on second request", async () => {
    render(<SwapRequestsPanel eventId="event-1" />);
    await waitFor(() => expect(screen.getByText(/matched/i)).toBeTruthy());
  });

  it("does NOT render the matchedBy side (req-3, Owl) — only canonical MATCHED cards", async () => {
    render(<SwapRequestsPanel eventId="event-1" />);
    await waitFor(() => expect(screen.getByText("Fox")).toBeTruthy());
    expect(screen.queryByText("Owl")).toBeNull();
  });

  it("PENDING request shows no Approve button", async () => {
    render(<SwapRequestsPanel eventId="event-1" />);
    await waitFor(() => expect(screen.getByText("Bear")).toBeTruthy());
    // Bear is PENDING — should have no Approve
    const approveButtons = screen.queryAllByRole("button", { name: /approve/i });
    // Only Fox (MATCHED) should have Approve; Bear should not
    expect(approveButtons.length).toBe(1);
  });

  it("PENDING request shows 'Waiting for partner' label", async () => {
    render(<SwapRequestsPanel eventId="event-1" />);
    await waitFor(() =>
      expect(screen.getByText(/waiting for partner/i)).toBeTruthy(),
    );
  });

  it("Approve button calls PUT with APPROVED status on MATCHED request", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockRequests }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

    render(<SwapRequestsPanel eventId="event-1" />);
    await waitFor(() => screen.getAllByRole("button", { name: /approve/i }));

    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/swap-requests/req-2",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ status: "APPROVED" }),
        }),
      ),
    );
  });

  it("Decline button calls PUT with DECLINED status", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockRequests }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

    render(<SwapRequestsPanel eventId="event-1" />);
    await waitFor(() => screen.getAllByText(/decline/i));

    fireEvent.click(screen.getAllByText(/decline/i)[0]);

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/swap-requests/req-1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ status: "DECLINED" }),
        }),
      ),
    );
  });

  it("shows empty state when no requests", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    render(<SwapRequestsPanel eventId="event-1" />);
    await waitFor(() =>
      expect(screen.getByText(/no pending swap requests/i)).toBeTruthy(),
    );
  });

  it("returns null when eventId is null", () => {
    const { container } = render(<SwapRequestsPanel eventId={null} />);
    expect(container.firstChild).toBeNull();
  });
});
