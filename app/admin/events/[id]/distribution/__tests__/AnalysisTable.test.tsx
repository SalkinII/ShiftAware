/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const exportMock = vi.fn();
vi.mock("@/lib/utils/export", () => ({
  exportDistributionAnalysisToPDF: (...args: unknown[]) => exportMock(...args),
}));

import { AnalysisTable } from "../components/AnalysisTable";

const analysisData = {
  members: [
    {
      id: "m1",
      alias: "Alice",
      avatarId: "A",
      assignedCount: 3,
      minShifts: 2,
      maxShifts: 5,
      byType: {},
      violations: [],
    },
  ],
};

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => ({ data: body }) } as Response;
}

describe("AnalysisTable export", () => {
  beforeEach(() => {
    exportMock.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(analysisData)),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports the loaded analysis data to PDF when the export button is clicked", async () => {
    render(
      <AnalysisTable
        eventId="evt-1"
        eventName="Starlight"
        onMemberSelect={vi.fn()}
        selectedMemberId={null}
      />,
    );

    const button = await screen.findByRole("button", { name: /export pdf/i });
    fireEvent.click(button);

    expect(exportMock).toHaveBeenCalledWith("Starlight", analysisData.members);
  });
});
