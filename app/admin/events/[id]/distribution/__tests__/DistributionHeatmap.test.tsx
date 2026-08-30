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
});
