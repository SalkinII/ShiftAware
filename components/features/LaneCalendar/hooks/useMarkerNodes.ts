import { useMemo } from "react";
import { type Node } from "@xyflow/react";
import { type LaneConfig } from "@/lib/types/lane";
import { timeToX, durationToWidth, laneIndexToY } from "../utils/coordinates";
import { Z_SHIFT_BLOCK, SHIFT_NODE_HEIGHT } from "../utils/constants";

export interface MarkerLike {
  id: string;
  text: string;
  startTime: string;
  endTime: string;
}

export interface UseMarkerNodesOptions {
  readOnly?: boolean;
  onSave?: (markerId: string, text: string) => void | Promise<void>;
  onDelete?: (markerId: string) => void | Promise<void>;
}

export function buildMarkerNodes(
  markers: MarkerLike[],
  lanes: LaneConfig[],
  eventStart: Date,
  options?: UseMarkerNodesOptions,
): Node[] {
  const { readOnly = false, onSave, onDelete } = options ?? {};
  const laneIndex = lanes.findIndex((l) => l.templateId === null);
  if (laneIndex < 0) return [];
  const y = laneIndexToY(laneIndex);

  return markers.map((marker) => {
    const x = timeToX(new Date(marker.startTime), eventStart);
    const durationMinutes = Math.round(
      (new Date(marker.endTime).getTime() - new Date(marker.startTime).getTime()) / 60000,
    );
    const width = durationToWidth(durationMinutes);
    const nodeId = `marker-${marker.id}`;

    return {
      id: nodeId,
      type: "marker",
      position: { x, y },
      data: {
        markerId: marker.id,
        text: marker.text,
        readOnly,
        onSave: !readOnly && onSave ? (text: string) => onSave(marker.id, text) : undefined,
        onDelete: !readOnly && onDelete ? () => onDelete(marker.id) : undefined,
      },
      style: { width, height: SHIFT_NODE_HEIGHT },
      draggable: !readOnly,
      selectable: true,
      zIndex: Z_SHIFT_BLOCK,
    };
  });
}

export function useMarkerNodes(
  markers: MarkerLike[] | null,
  lanes: LaneConfig[],
  eventStart: Date | null,
  options?: UseMarkerNodesOptions,
) {
  const { readOnly = false, onSave, onDelete } = options ?? {};
  return useMemo(() => {
    if (!markers || !eventStart || lanes.length === 0) return [];
    return buildMarkerNodes(markers, lanes, eventStart, { readOnly, onSave, onDelete });
  }, [markers, lanes, eventStart, readOnly, onSave, onDelete]);
}
