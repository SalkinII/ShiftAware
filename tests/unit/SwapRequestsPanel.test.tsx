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

  it("Approve button calls PUT with APPROVED status", async () => {
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
    await waitFor(() => screen.getAllByText(/approve/i));

    fireEvent.click(screen.getAllByText(/approve/i)[0]);

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/swap-requests/req-1",
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
