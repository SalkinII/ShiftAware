import { useMemo } from "react";
import { type Node } from "@xyflow/react";
import { type LaneConfig } from "@/lib/types/lane";
import { timeToX, durationToWidth, laneIndexToY } from "../utils/coordinates";
import { Z_SHIFT_BLOCK } from "../utils/constants";

export interface ShiftLike {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  durationMinutes?: number; // computed from start/end if missing
  capacity: number;
  desirabilityScore?: number;
  assignments?: {
    id: string;
    teamMemberId?: string;
    teamMember?: { id?: string; alias?: string; avatarId?: string };
  }[];
  _count?: { assignments?: number; preferences?: number };
  event?: { id: string; name: string };
  templateId?: string | null;
}

export type OnResizeEndHandler = (
  nodeId: string,
  params: { width: number },
) => void | Promise<void>;

export interface UseShiftNodesOptions {
  onResizeEnd?: OnResizeEndHandler;
  readOnly?: boolean;
  onVoteWant?: (shiftId: string) => void;
  onVoteDontWant?: (shiftId: string) => void;
  /** When set, shifts assigned to this member get isAssignedToCurrentUser: true */
  selectedMemberId?: string | null;
}

export function buildShiftNodes(
  shifts: ShiftLike[],
  lanes: LaneConfig[],
  eventStart: Date,
  options?: UseShiftNodesOptions,
): Node[] {
  const { onResizeEnd, readOnly = false } = options ?? {};
  // Match by templateId; shifts with templateId=null go to Unassigned lane
  const laneIndexMap = new Map(
    lanes.map((lane, i) => [lane.templateId ?? "unassigned", i]),
  );
  const unassignedIndex = lanes.findIndex((l) => l.templateId === null);

  return shifts
    .filter((shift) => {
      const key = shift.templateId ?? "unassigned";
      return laneIndexMap.has(key) || unassignedIndex >= 0;
    })
    .map((shift) => {
      const key = shift.templateId ?? "unassigned";
      const laneIndex =
        laneIndexMap.get(key) ?? (unassignedIndex >= 0 ? unassignedIndex : 0);
      const x = timeToX(new Date(shift.startTime), eventStart);
      const y = laneIndexToY(laneIndex);
      const durationMinutes =
        shift.durationMinutes ??
        Math.round(
          (new Date(shift.endTime).getTime() -
            new Date(shift.startTime).getTime()) /
            60000,
        );
      const width = durationToWidth(durationMinutes);
      const lane = lanes[laneIndex];
      const nodeId = `shift-${shift.id}`;

      return {
        id: nodeId,
        type: "shiftBlock",
        position: { x, y },
        data: {
          shiftId: shift.id,
          color: lane.color,
          width,
          onResizeEnd:
            !readOnly &&
            onResizeEnd &&
            ((_e: unknown, p: { width: number }) => onResizeEnd(nodeId, p)),
          readOnly,
        },
        style: { width, height: 4 },
        draggable: !readOnly,
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
  options?: UseShiftNodesOptions,
) {
  const { onResizeEnd, readOnly = false } = options ?? {};
  return useMemo(() => {
    if (!shifts || !eventStart || lanes.length === 0) return [];
    return buildShiftNodes(shifts, lanes, eventStart, {
      onResizeEnd,
      readOnly,
    });
  }, [shifts, lanes, eventStart, onResizeEnd, readOnly]);
}
