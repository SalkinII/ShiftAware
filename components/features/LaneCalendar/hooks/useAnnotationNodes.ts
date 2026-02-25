"use client";

import { useMemo } from "react";
import { type Node } from "@xyflow/react";
import { format } from "date-fns";
import type { ShiftAnnotationData } from "../nodes/ShiftAnnotationNode";
import {
  timeToX,
  laneIndexToY,
} from "../utils/coordinates";
import type { LaneConfig } from "@/lib/types/lane";

interface ShiftLike {
  id: string;
  startTime: string;
  endTime: string;
  templateId?: string | null;
  capacity: number;
  desirabilityScore?: number;
  assignments?: Array<{
    teamMember?: { alias: string; avatarId?: string };
  }>;
}

export function useAnnotationNodes(
  shifts: ShiftLike[],
  lanes: LaneConfig[],
  eventStart: Date | null,
  _zoom: number
): Node<ShiftAnnotationData>[] {
  return useMemo(() => {
    if (!eventStart || shifts.length === 0) return [];

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
        const lane = lanes[laneIndex];

        const x = timeToX(new Date(shift.startTime), eventStart);
        const y = laneIndexToY(laneIndex);

        const startTime = format(new Date(shift.startTime), "HH:mm");
        const endTime = format(new Date(shift.endTime), "HH:mm");
        const timeLabel = `${startTime} - ${endTime}`;

        const assignedMembers =
          shift.assignments?.map((a) => ({
            alias: a.teamMember?.alias ?? "?",
            avatarId: a.teamMember?.avatarId,
          })) ?? [];

        return {
          id: `annotation-${shift.id}`,
          type: "shiftAnnotation",
          position: { x, y },
          data: {
            timeLabel,
            shiftName: lane?.label ?? "Unnamed Shift",
            assignmentCount: assignedMembers.length,
            capacity: shift.capacity,
            assignedMembers,
            desirabilityScore: shift.desirabilityScore,
            color: lane?.color ?? "#64748b",
            parentShiftId: shift.id,
          },
          draggable: false,
          selectable: false,
          zIndex: 1000,
        };
      });
  }, [shifts, lanes, eventStart, _zoom]);
}
