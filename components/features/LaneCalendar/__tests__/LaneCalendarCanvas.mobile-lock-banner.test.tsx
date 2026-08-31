/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LaneCalendarCanvas, mergeNodes } from "../LaneCalendarCanvas";
import { ToastProvider } from "@/components/ui/Toast";
import { RULER_HEIGHT } from "../utils/constants";

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="react-flow-mock">{children}</div>
  ),
  ReactFlowProvider: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
  Controls: () => null,
  MiniMap: () => null,
  Panel: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useReactFlow: () => ({ fitView: vi.fn() }),
  useViewport: () => ({ zoom: 1, x: 0, y: 0 }),
  applyNodeChanges: (_changes: unknown, nodes: unknown) => nodes,
}));

const lanes = [
  {
    id: "lane-1",
    templateId: "tpl-1",
    label: "Mobile Team",
    color: "#0ea5e9",
    order: 0,
    type: "MOBILE_TEAM",
  },
];

describe("LaneCalendarCanvas — mobile lock banner layout", () => {
  it("does not absolutely position the lock banner over the canvas", () => {
    render(
      <ToastProvider>
        <LaneCalendarCanvas
          shifts={[]}
          lanes={lanes}
          eventStart={new Date("2026-08-01T00:00:00.000Z")}
          eventEnd={new Date("2026-08-02T00:00:00.000Z")}
          eventId="event-1"
          shiftMutationLocked
          shiftMutationLockedMessage="Shift editing is locked for the current event state"
        />
      </ToastProvider>,
    );

    const banner = screen.getByTestId("shift-mutation-locked-banner");
    // Absolute positioning is what let the banner's real (wrapped, 2-line)
    // height overflow past the hardcoded paddingTop reservation and cover
    // the time ruler below it on narrow viewports.
    expect(banner.className).not.toMatch(/\babsolute\b/);
    expect(banner.className).toMatch(/\bflex-shrink-0\b/);

    const wrapper = banner.parentElement!;
    expect(wrapper.className).toMatch(/\bflex\b/);
    expect(wrapper.className).toMatch(/\bflex-col\b/);
    // No more hardcoded pixel guess for the banner's height.
    expect(wrapper.style.paddingTop).toBe("");
  });

  it("anchors topRightOverlay to the flow area, not the outer wrapper shared with the lock banner", () => {
    render(
      <ToastProvider>
        <LaneCalendarCanvas
          shifts={[]}
          lanes={lanes}
          eventStart={new Date("2026-08-01T00:00:00.000Z")}
          eventEnd={new Date("2026-08-02T00:00:00.000Z")}
          eventId="event-1"
          shiftMutationLocked
          shiftMutationLockedMessage="Shift editing is locked for the current event state"
          topRightOverlay={<button>2 swaps pending</button>}
        />
      </ToastProvider>,
    );

    const banner = screen.getByTestId("shift-mutation-locked-banner");
    const overlayWrapper = screen.getByTestId("canvas-top-right-overlay");

    // The lock banner's rendered height varies (it wraps on narrow screens),
    // so an overlay positioned relative to the SAME container as the banner
    // can never reliably clear the ruler below it. It must instead be
    // anchored inside the flow area, which always starts at the ruler
    // regardless of the lock banner's height or presence.
    expect(overlayWrapper.parentElement).not.toBe(banner.parentElement);
    expect(overlayWrapper.className).toMatch(/\babsolute\b/);
    expect(overlayWrapper.style.top).toBe(`${RULER_HEIGHT + 12}px`);
    expect(overlayWrapper.textContent).toContain("2 swaps pending");
  });

  it("preserves a marker node's ReactFlow-owned position across a refetch, same as a shift node", () => {
    const current = [{ id: "marker-m1", position: { x: 999, y: 5 }, data: {}, type: "marker" }] as any;
    const merged = mergeNodes(current, [], [{ id: "marker-m1", position: { x: 0, y: 5 }, data: { text: "new" }, type: "marker" }] as any);
    expect(merged.find((n: any) => n.id === "marker-m1")?.position.x).toBe(999);
  });
});
