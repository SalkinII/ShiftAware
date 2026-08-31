/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";

const mockGetNode = vi.fn();
const mockGetNodes = vi.fn(() => []);
const mockScreenToFlowPosition = vi.fn(({ x, y }: { x: number; y: number }) => ({ x, y }));

vi.mock("@xyflow/react", () => ({
  useReactFlow: () => ({
    screenToFlowPosition: mockScreenToFlowPosition,
    getNode: mockGetNode,
    getNodes: mockGetNodes,
  }),
}));

import { useCanvasActions } from "./useCanvasActions";

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(ToastProvider, null, children);
}

const lanes = [
  { id: "lane-1", templateId: "tpl-1", label: "Mobile", color: "#000", order: 0, type: "MOBILE_TEAM" },
];

describe("useCanvasActions — markers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    vi.clearAllMocks();
    mockGetNodes.mockReturnValue([]);
  });

  it("handleDrop POSTs to /api/markers when the drop payload is a marker", async () => {
    const { result } = renderHook(
      () => useCanvasActions({ lanes, eventStart: new Date("2026-08-01T00:00:00Z"), eventId: "evt-1" }),
      { wrapper },
    );

    const dataTransfer = {
      getData: (key: string) => (key === "application/shiftaware-marker" ? JSON.stringify({ durationMinutes: 30 }) : ""),
    };
    const event = {
      preventDefault: vi.fn(),
      dataTransfer,
      clientX: 100,
      clientY: 50,
    } as unknown as React.DragEvent;

    await result.current.handleDrop(event);

    expect(fetch).toHaveBeenCalledWith(
      "/api/markers",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"eventId":"evt-1"'),
      }),
    );
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.text).toBe("");
    expect(body.startTime).toBeTruthy();
    expect(body.endTime).toBeTruthy();
  });

  it("handleNodeDragStop does not PATCH for a marker- node (visual snap-back only)", async () => {
    const { result } = renderHook(
      () => useCanvasActions({ lanes, eventStart: new Date("2026-08-01T00:00:00Z"), eventId: "evt-1" }),
      { wrapper },
    );

    const node = { id: "marker-m1", position: { x: 10, y: 5 }, data: {} } as any;
    await result.current.handleNodeDragStop({} as React.MouseEvent, node);

    expect(fetch).not.toHaveBeenCalled();
  });

  it("handleResizeEnd PATCHes /api/markers/[id] for a marker- nodeId", async () => {
    mockGetNode.mockReturnValue({ id: "marker-m1", position: { x: 100, y: 0 }, data: {} });
    const { result } = renderHook(
      () => useCanvasActions({ lanes, eventStart: new Date("2026-08-01T00:00:00Z"), eventId: "evt-1" }),
      { wrapper },
    );

    await result.current.handleResizeEnd("marker-m1", { width: 200 });

    expect(fetch).toHaveBeenCalledWith(
      "/api/markers/m1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
