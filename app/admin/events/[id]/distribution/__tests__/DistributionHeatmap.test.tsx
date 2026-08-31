/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DistributionHeatmap } from "../components/DistributionHeatmap";

const heatmapData = {
  shifts: [
    {
      id: "s1",
      type: "MOBILE_TEAM",
      templateId: null,
      templateName: "Mobile Team",
      startTime: "2026-08-01T08:00:00.000Z",
      endTime: "2026-08-01T16:00:00.000Z",
      capacity: 2,
      requiredRoles: [],
    },
  ],
  members: [{ id: "m1", alias: "Alice", attributes: {} }],
  assignments: [],
  preferences: [],
  config: {},
  allocationRules: [],
};

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => ({ data: body }),
  } as Response;
}

describe("DistributionHeatmap", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(heatmapData)),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not select the member row when clicking an eligible cell", async () => {
    const onMemberSelect = vi.fn();
    render(
      <DistributionHeatmap
        eventId="evt-1"
        previewData={null}
        highlightMemberId={null}
        onMemberSelect={onMemberSelect}
      />,
    );

    const cell = await screen.findByTitle("eligible");
    fireEvent.click(cell);

    expect(onMemberSelect).not.toHaveBeenCalled();
  });

  it("distinguishes same-day shifts by time and type in the column header", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          ...heatmapData,
          shifts: [
            {
              id: "s1",
              type: "MOBILE_TEAM",
              templateId: null,
              startTime: "2026-08-01T08:00:00.000Z",
              endTime: "2026-08-01T16:00:00.000Z",
              capacity: 2,
              requiredRoles: [],
            },
            {
              id: "s2",
              type: "STAGE",
              templateId: null,
              startTime: "2026-08-01T16:00:00.000Z",
              endTime: "2026-08-01T22:00:00.000Z",
              capacity: 2,
              requiredRoles: [],
            },
          ],
        }),
      ),
    );

    render(
      <DistributionHeatmap
        eventId="evt-1"
        previewData={null}
        highlightMemberId={null}
        onMemberSelect={vi.fn()}
      />,
    );

    const s1Start = new Date("2026-08-01T08:00:00.000Z").toLocaleTimeString(
      "en-GB",
      { hour: "2-digit", minute: "2-digit" },
    );
    const s2Start = new Date("2026-08-01T16:00:00.000Z").toLocaleTimeString(
      "en-GB",
      { hour: "2-digit", minute: "2-digit" },
    );
    expect(await screen.findByText(s1Start)).toBeInTheDocument();
    expect(screen.getByText(s2Start)).toBeInTheDocument();

    const headers = screen.getAllByRole("columnheader");
    const shiftHeaders = headers.filter((h) => h.title);
    expect(shiftHeaders.find((h) => h.title.includes("MOBILE_TEAM"))).toBeTruthy();
    expect(shiftHeaders.find((h) => h.title.includes("STAGE"))).toBeTruthy();
  });

  it("filters members by name search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          ...heatmapData,
          members: [
            { id: "m1", alias: "Alice", attributes: {} },
            { id: "m2", alias: "Bob", attributes: {} },
          ],
        }),
      ),
    );

    render(
      <DistributionHeatmap
        eventId="evt-1"
        previewData={null}
        highlightMemberId={null}
        onMemberSelect={vi.fn()}
      />,
    );

    await screen.findByText("Alice");
    expect(screen.getByText("Bob")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search member..."), {
      target: { value: "ali" },
    });

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
  });

  it("filters members by attribute value", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          ...heatmapData,
          members: [
            { id: "m1", alias: "Alice", attributes: { role: "medic" } },
            { id: "m2", alias: "Bob", attributes: { role: "driver" } },
          ],
        }),
      ),
    );

    render(
      <DistributionHeatmap
        eventId="evt-1"
        previewData={null}
        highlightMemberId={null}
        onMemberSelect={vi.fn()}
      />,
    );

    await screen.findByText("Alice");

    fireEvent.change(screen.getByLabelText("Attribute"), {
      target: { value: "role" },
    });
    fireEvent.change(screen.getByLabelText("Attribute value"), {
      target: { value: "medic" },
    });

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
  });

  it("does not disable a blocked cell (admin can still click it)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          ...heatmapData,
          config: { balanceThresholds: { maxShiftsPerPerson: 0 } },
        }),
      ),
    );

    render(
      <DistributionHeatmap
        eventId="evt-1"
        previewData={null}
        highlightMemberId={null}
        onMemberSelect={vi.fn()}
      />,
    );

    const cell = await screen.findByTitle(/blocked/);
    expect(cell).not.toBeDisabled();
  });

  it("asks for confirmation naming the reason, and does not assign when cancelled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ...heatmapData,
        config: { balanceThresholds: { maxShiftsPerPerson: 0 } },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));

    render(
      <DistributionHeatmap
        eventId="evt-1"
        previewData={null}
        highlightMemberId={null}
        onMemberSelect={vi.fn()}
      />,
    );

    const cell = await screen.findByTitle(/blocked/);
    fireEvent.click(cell);

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("maximum shift count"),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/assignments",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("assigns the member anyway when the override is confirmed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ...heatmapData,
        config: { balanceThresholds: { maxShiftsPerPerson: 0 } },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

    render(
      <DistributionHeatmap
        eventId="evt-1"
        previewData={null}
        highlightMemberId={null}
        onMemberSelect={vi.fn()}
      />,
    );

    const cell = await screen.findByTitle(/blocked/);
    fireEvent.click(cell);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/assignments",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("still selects the member when clicking the member name", async () => {
    const onMemberSelect = vi.fn();
    render(
      <DistributionHeatmap
        eventId="evt-1"
        previewData={null}
        highlightMemberId={null}
        onMemberSelect={onMemberSelect}
      />,
    );

    const name = await screen.findByText("Alice");
    fireEvent.click(name);

    expect(onMemberSelect).toHaveBeenCalledWith("m1");
  });

  it("renders a cross-event-conflicted cell as blocked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          ...heatmapData,
          shifts: [{ ...heatmapData.shifts[0], eventId: "evt-1" }],
          crossEventAssignments: [
            {
              memberId: "m1",
              shift: {
                id: "x",
                eventId: "evt-2",
                startTime: "2026-08-01T09:00:00.000Z",
                endTime: "2026-08-01T12:00:00.000Z",
              },
            },
          ],
        }),
      ),
    );

    render(
      <DistributionHeatmap
        eventId="evt-1"
        previewData={null}
        highlightMemberId={null}
        onMemberSelect={vi.fn()}
      />,
    );

    const cell = await screen.findByTitle(/blocked/);
    expect(cell.title).toContain("another event");
  });

  it("renders a blackout_window-blocked cell as blocked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          ...heatmapData,
          members: [
            {
              id: "m1",
              alias: "Alice",
              attributes: {
                availability: JSON.stringify({
                  availabilityWindows: [],
                  dailyBlackouts: [{ date: "2026-08-01", startHour: 0, endHour: 23 }],
                }),
              },
            },
          ],
          attributeDefinitions: [{ id: "d1", name: "availability", type: "TIME_CONSTRAINT" }],
        }),
      ),
    );

    render(
      <DistributionHeatmap
        eventId="evt-1"
        previewData={null}
        highlightMemberId={null}
        onMemberSelect={vi.fn()}
      />,
    );

    const cell = await screen.findByTitle(/blocked/);
    expect(cell.title).toContain("blackout");
  });
});
