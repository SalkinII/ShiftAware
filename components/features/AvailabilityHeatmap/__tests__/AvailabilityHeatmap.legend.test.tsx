/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockHeatmapData = {
  members: [
    {
      id: "m1",
      alias: "Alice",
      avatarId: "🐱",
      experienceLevel: "INTERMEDIATE",
      capabilities: [],
      isActive: true,
    },
  ],
  shifts: [
    {
      id: "s1",
      type: "GENERAL",
      templateName: "Morning",
      startTime: "2026-06-01T08:00:00Z",
      endTime: "2026-06-01T16:00:00Z",
      capacity: 2,
      priority: "CORE",
    },
  ],
  availability: [
    [
      {
        memberId: "m1",
        shiftId: "s1",
        status: "available" as const,
        hasPreference: false,
        isAssigned: false,
        hasConflict: false,
        meetsRequirements: true,
      },
    ],
  ],
  summary: {
    totalMembers: 1,
    totalShifts: 1,
    availableCount: 1,
    partialCount: 0,
    unavailableCount: 0,
    neutralCount: 0,
  },
};

vi.mock("@/lib/cache/useCache", () => ({
  useCache: () => ({ data: mockHeatmapData, loading: false, error: null, refetch: vi.fn() }),
}));
vi.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));
vi.mock("@/lib/api-errors", () => ({
  unwrapApiResponse: (d: any) => (d?.data !== undefined ? d.data : d),
}));

import { AvailabilityHeatmap } from "../AvailabilityHeatmap";

describe("AvailabilityHeatmap – legend mobile layout", () => {
  it("legend container has flex-wrap so items reflow on narrow screens", () => {
    render(<AvailabilityHeatmap />);
    const assignedLabel = screen.getByText("Assigned");
    // assignedLabel → legend item div → legend container div
    const legendContainer = assignedLabel.parentElement!.parentElement!;
    expect(legendContainer.className).toContain("flex-wrap");
  });
});
