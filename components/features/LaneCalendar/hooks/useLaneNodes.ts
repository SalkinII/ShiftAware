import { useMemo } from "react";
import { type Node } from "@xyflow/react";
import { format, addDays, startOfDay, differenceInDays } from "date-fns";
import { type LaneConfig } from "@/lib/types/lane";
import {
  LANE_HEIGHT,
  Z_LANE_ZONE,
  Z_DAY_SEPARATOR,
  Z_HOUR_GRID,
  PIXELS_PER_HOUR,
} from "../utils/constants";
import { timeToX } from "../utils/coordinates";

export function buildLaneNodes(
  lanes: LaneConfig[],
  timelineWidth: number,
): Node[] {
  return lanes.map((lane, index) => ({
    id: `lane-zone-${lane.id}`,
    type: "laneZone",
    position: { x: 0, y: index * LANE_HEIGHT },
    data: {
      label: lane.label,
      color: lane.color,
      width: timelineWidth,
    },
    draggable: false,
    selectable: false,
    zIndex: Z_LANE_ZONE,
  }));
}

export function buildDaySeparatorNodes(
  eventStart: Date,
  eventEnd: Date,
  canvasHeight: number,
): Node[] {
  const nodes: Node[] = [];
  const totalDays = differenceInDays(eventEnd, eventStart) + 1;

  for (let d = 0; d <= totalDays; d++) {
    const midnight = startOfDay(addDays(eventStart, d));
    const x = timeToX(midnight, eventStart);

    nodes.push({
      id: `day-sep-${d}`,
      type: "daySeparator",
      position: { x, y: 0 },
      data: {
        label: format(midnight, "d MMM yyyy"),
        height: canvasHeight,
      },
      draggable: false,
      selectable: false,
      zIndex: Z_DAY_SEPARATOR,
    });
  }

  return nodes;
}

export function buildHourGridNodes(
  eventStart: Date,
  eventEnd: Date,
  canvasHeight: number,
): Node[] {
  const totalDays = differenceInDays(eventEnd, eventStart) + 1;
  const totalHours = totalDays * 24;

  const nodes: Node[] = [];
  for (let h = 0; h <= totalHours; h++) {
    nodes.push({
      id: `hour-grid-${h}`,
      type: "hourGrid",
      position: { x: h * PIXELS_PER_HOUR, y: 0 },
      data: { height: canvasHeight },
      draggable: false,
      selectable: false,
      zIndex: Z_HOUR_GRID,
    });
  }
  return nodes;
}

/**
 * Hook that builds lane zone and day separator nodes.
 */
export function useLaneNodes(
  lanes: LaneConfig[],
  eventStart: Date | null,
  eventEnd: Date | null,
) {
  return useMemo(() => {
    if (!eventStart || !eventEnd || lanes.length === 0) return [];

    const totalDays = differenceInDays(eventEnd, eventStart) + 1;
    const timelineWidth = totalDays * 24 * PIXELS_PER_HOUR;
    const canvasHeight = lanes.length * LANE_HEIGHT;

    const laneNodes = buildLaneNodes(lanes, timelineWidth);
    const gridNodes = buildHourGridNodes(eventStart, eventEnd, canvasHeight);
    const separatorNodes = buildDaySeparatorNodes(
      eventStart,
      eventEnd,
      canvasHeight,
    );

    return [...laneNodes, ...gridNodes, ...separatorNodes];
  }, [lanes, eventStart, eventEnd]);
}
