"use client";

import { useCallback } from "react";
import { type Node, useReactFlow } from "@xyflow/react";
import { type LaneConfig } from "@/lib/types/lane";
import { snapX, snapY, xToTime, yToLaneIndex, widthToDuration } from "../utils/coordinates";
import { SNAP_INTERVAL_MINUTES } from "../utils/constants";
import { roundToInterval } from "@/lib/utils/snap";

interface UseCanvasActionsOptions {
  lanes: LaneConfig[];
  eventStart: Date | null;
  eventId: string | null;
  onShiftCreated?: () => void;
  onShiftUpdated?: () => void;
}

export function useCanvasActions({
  lanes,
  eventStart,
  eventId,
  onShiftCreated,
  onShiftUpdated,
}: UseCanvasActionsOptions) {
  const { screenToFlowPosition } = useReactFlow();

  /**
   * Handle external template drop (sidebar → canvas).
   */
  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      if (!eventStart || !eventId) return;

      const templateData = event.dataTransfer.getData("application/shiftaware-template");
      if (!templateData) return;

      const template = JSON.parse(templateData);
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });

      const snappedX = snapX(flowPos.x);
      const snappedY = snapY(flowPos.y);

      const startTime = xToTime(snappedX, eventStart);
      const laneIndex = yToLaneIndex(snappedY);

      if (laneIndex < 0 || laneIndex >= lanes.length) return;

      const lane = lanes[laneIndex];
      const endTime = new Date(startTime.getTime() + template.durationMinutes * 60000);

      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          type: lane.type,
          templateId: template.id,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          durationMinutes: template.durationMinutes,
          priority: template.priority || "CORE",
          desirabilityScore: template.desirabilityScore || 3,
          capacity: template.capacity || 2,
          requiredRoles: template.requiredRoles || [{ role: "TEAM_MEMBER", count: template.capacity || 2 }],
        }),
      });

      if (res.ok) {
        window.dispatchEvent(
          new CustomEvent("shiftaware:cache-invalidate", {
            detail: { keys: ["shifts", "shifts*"] },
          }),
        );
        onShiftCreated?.();
      }
    },
    [eventStart, eventId, lanes, screenToFlowPosition, onShiftCreated],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  /**
   * Handle internal shift reposition (drag stop).
   */
  const handleNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      if (!node.id.startsWith("shift-") || !eventStart) return;

      const shiftId = (node.data as any).shiftId;
      const snappedX = snapX(node.position.x);
      const snappedY = snapY(node.position.y);

      const newStartTime = xToTime(snappedX, eventStart);
      const laneIndex = yToLaneIndex(snappedY);

      if (laneIndex < 0 || laneIndex >= lanes.length) return;

      const lane = lanes[laneIndex];
      const durationMs = new Date((node.data as any).endTime).getTime() - new Date((node.data as any).startTime).getTime();
      const newEndTime = new Date(newStartTime.getTime() + durationMs);

      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: shiftId,
          type: lane.type,
          startTime: newStartTime.toISOString(),
          endTime: newEndTime.toISOString(),
        }),
      });

      if (res.ok) {
        window.dispatchEvent(
          new CustomEvent("shiftaware:cache-invalidate", {
            detail: { keys: ["shifts", "shifts*"] },
          }),
        );
        onShiftUpdated?.();
      }
    },
    [eventStart, lanes, onShiftUpdated],
  );

  /**
   * Handle node resize end (duration change).
   */
  const handleResizeEnd = useCallback(
    async (_event: unknown, params: { id: string; style?: { width?: number } }) => {
      // React Flow node-resizer updates node style.width
      // We need to read the updated width and convert to duration
      // This will be called from onNodesChange or a custom resize handler
    },
    [],
  );

  return {
    handleDrop,
    handleDragOver,
    handleNodeDragStop,
    handleResizeEnd,
  };
}
