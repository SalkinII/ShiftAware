import { useMemo } from "react";
import { type Node } from "@xyflow/react";
import { type LaneConfig } from "@/lib/types/lane";
import { getLaneColor } from "@/lib/types/lane";
import { timeToX, durationToWidth, laneIndexToY } from "../utils/coordinates";
import { Z_SHIFT_BLOCK, SHIFT_NODE_HEIGHT } from "../utils/constants";

export interface ShiftLike {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  capacity: number;
  assignments?: { id: string; teamMember?: { alias?: string } }[];
  _count?: { assignments?: number; preferences?: number };
  event?: { id: string; name: string };
  templateId?: string | null;
}

export function buildShiftNodes(
  shifts: ShiftLike[],
  lanes: LaneConfig[],
  eventStart: Date,
): Node[] {
  const laneIndexMap = new Map(lanes.map((lane, i) => [lane.type, i]));

  return shifts
    .filter((shift) => laneIndexMap.has(shift.type))
    .map((shift) => {
      const laneIndex = laneIndexMap.get(shift.type)!;
      const x = timeToX(new Date(shift.startTime), eventStart);
      const y = laneIndexToY(laneIndex);
      const width = durationToWidth(shift.durationMinutes);
      const lane = lanes[laneIndex];

      return {
        id: `shift-${shift.id}`,
        type: "shiftBlock",
        position: { x, y },
        data: {
          shiftId: shift.id,
          templateName: lane.label,
          type: shift.type,
          color: lane.color,
          startTime: shift.startTime,
          endTime: shift.endTime,
          capacity: shift.capacity,
          assignmentCount: shift.assignments?.length ?? shift._count?.assignments ?? 0,
          width,
        },
        style: { width, height: SHIFT_NODE_HEIGHT },
        draggable: true,
        selectable: true,
        zIndex: Z_SHIFT_BLOCK,
      };
    });
}

/**
 * Hook that converts API shift data to React Flow nodes.
 */
export function useShiftNodes(
  shifts: ShiftLike[] | null,
  lanes: LaneConfig[],
  eventStart: Date | null,
) {
  return useMemo(() => {
    if (!shifts || !eventStart || lanes.length === 0) return [];
    return buildShiftNodes(shifts, lanes, eventStart);
  }, [shifts, lanes, eventStart]);
}
