"use client";

import { useCallback } from "react";
import { type Node, useReactFlow } from "@xyflow/react";
import { type LaneConfig } from "@/lib/types/lane";
import {
  snapX,
  snapY,
  xToTime,
  yToLaneIndex,
  widthToDuration,
} from "../utils/coordinates";
import { SNAP_INTERVAL_MINUTES } from "../utils/constants";
import { useToast } from "@/components/ui/Toast";

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
  const { screenToFlowPosition, getNode } = useReactFlow();
  const toast = useToast();

  /**
   * Handle external template drop (sidebar → canvas).
   */
  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      if (!eventStart || !eventId) return;

      const templateData = event.dataTransfer.getData(
        "application/shiftaware-template",
      );
      if (!templateData) return;

      const template = JSON.parse(templateData);
      const flowPos = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const snappedX = snapX(flowPos.x);
      const snappedY = snapY(flowPos.y);

      const startTime = xToTime(snappedX, eventStart);
      const laneIndex = yToLaneIndex(snappedY);

      if (laneIndex < 0 || laneIndex >= lanes.length) return;

      const lane = lanes[laneIndex];
      const endTime = new Date(
        startTime.getTime() + template.durationMinutes * 60000,
      );

      try {
        const res = await fetch("/api/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            type: template.type,
            templateId: template.id,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            durationMinutes: template.durationMinutes,
            priority: template.priority || "CORE",
            desirabilityScore: template.desirabilityScore || 3,
            capacity: template.capacity || 2,
            requiredRoles: template.requiredRoles || [
              { role: "TEAM_MEMBER", count: template.capacity || 2 },
            ],
          }),
        });

        if (res.ok) {
          window.dispatchEvent(
            new CustomEvent("shiftaware:cache-invalidate", {
              detail: { keys: ["shifts", "shifts*"] },
            }),
          );
          onShiftCreated?.();
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || "Failed to create shift");
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to create shift",
        );
      }
    },
    [eventStart, eventId, lanes, screenToFlowPosition, onShiftCreated, toast],
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
      const durationMs =
        new Date((node.data as any).endTime).getTime() -
        new Date((node.data as any).startTime).getTime();
      const newEndTime = new Date(newStartTime.getTime() + durationMs);

      try {
        const res = await fetch(`/api/shifts/${shiftId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: shiftId,
            type: lane.type,
            templateId: lane.templateId ?? undefined,
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
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || "Failed to update shift");
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update shift",
        );
      }
    },
    [eventStart, lanes, onShiftUpdated, toast],
  );

  /**
   * Handle node resize end (duration change).
   * Converts width to duration, snaps to 15min, persists via PUT.
   */
  const handleResizeEnd = useCallback(
    async (nodeId: string, params: { width: number }) => {
      if (!eventStart || !eventId || !nodeId.startsWith("shift-")) return;

      const shiftId = nodeId.replace("shift-", "");
      const node = getNode(nodeId);
      if (!node?.data) return;

      const startTime = new Date((node.data as any).startTime);
      const durationMinutes =
        Math.round(widthToDuration(params.width) / SNAP_INTERVAL_MINUTES) *
        SNAP_INTERVAL_MINUTES;
      const snappedDuration = Math.max(SNAP_INTERVAL_MINUTES, durationMinutes);
      const newEndTime = new Date(
        startTime.getTime() + snappedDuration * 60 * 1000,
      );

      try {
        const res = await fetch(`/api/shifts/${shiftId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: shiftId,
            startTime: startTime.toISOString(),
            endTime: newEndTime.toISOString(),
            durationMinutes: snappedDuration,
          }),
        });

        if (res.ok) {
          window.dispatchEvent(
            new CustomEvent("shiftaware:cache-invalidate", {
              detail: { keys: ["shifts", "shifts*"] },
            }),
          );
          onShiftUpdated?.();
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || "Failed to update shift");
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update shift",
        );
      }
    },
    [eventStart, eventId, onShiftUpdated, toast, getNode],
  );

  return {
    handleDrop,
    handleDragOver,
    handleNodeDragStop,
    handleResizeEnd,
  };
}
