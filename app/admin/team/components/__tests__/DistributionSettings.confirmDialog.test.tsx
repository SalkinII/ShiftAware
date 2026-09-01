/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/lib/contexts/EventContext", () => ({
  useEventContext: () => ({
    selectedEventId: "evt-1",
    selectedEvent: { id: "evt-1", name: "Test Event", status: "ASSIGNING" },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/components/features/AlgorithmResultsModal", () => ({
  AlgorithmResultsModal: () => null,
}));
vi.mock("@/lib/api-errors", () => ({
  unwrapApiResponse: (d: any) => (d?.data !== undefined ? d.data : d),
}));

vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: null }) }),
);

import { DistributionSettings } from "../DistributionSettings";

describe("DistributionSettings – run algorithm confirmation", () => {
  it("opens a ConfirmDialog instead of window.confirm when running the algorithm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    render(<DistributionSettings />);

    const runBtn = await screen.findByRole("button", { name: /run assignment/i });
    fireEvent.click(runBtn);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/this will replace all current assignments/i)).toBeInTheDocument();
  });
});
