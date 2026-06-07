import { useMemo } from "react";
import { type Node } from "@xyflow/react";
import { type LaneConfig } from "@/lib/types/lane";
import { timeToX, durationToWidth, laneIndexToY } from "../utils/coordinates";
import { Z_SHIFT_BLOCK, SHIFT_NODE_HEIGHT } from "../utils/constants";

export interface ShiftLike {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  durationMinutes?: number;
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
  params: { width: number; x?: number },
) => void | Promise<void>;

export interface UseShiftNodesOptions {
  onResizeEnd?: OnResizeEndHandler;
  readOnly?: boolean;
  onVoteWant?: (shiftId: string) => void;
  onVoteDontWant?: (shiftId: string) => void;
  selectedMemberId?: string | null;
  preferences?: Map<string, "WANT" | "DONT_WANT">;
}

export function buildShiftNodes(
  shifts: ShiftLike[],
  lanes: LaneConfig[],
  eventStart: Date,
  options?: UseShiftNodesOptions,
): Node[] {
  const {
    onResizeEnd,
    readOnly = false,
    onVoteWant,
    onVoteDontWant,
    selectedMemberId,
    preferences,
  } = options ?? {};
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
          templateName: lane.label,
          type: shift.type,
          color: lane.color,
          startTime: shift.startTime,
          endTime: shift.endTime,
          capacity: shift.capacity,
          assignmentCount:
            shift.assignments?.length ?? shift._count?.assignments ?? 0,
          desirabilityScore: shift.desirabilityScore,
          assignedMembers:
            shift.assignments?.map(
              (a: { teamMember?: { alias?: string; avatarId?: string } }) => ({
                alias: a.teamMember?.alias || "?",
                avatarId: a.teamMember?.avatarId || "",
              }),
            ) ?? [],
          isAssignedToCurrentUser:
            !!selectedMemberId &&
            (shift.assignments ?? []).some(
              (a) =>
                (a as { teamMemberId?: string }).teamMemberId ===
                  selectedMemberId ||
                (a as { teamMember?: { id?: string } }).teamMember?.id ===
                  selectedMemberId,
            ),
          onResizeEnd:
            !readOnly &&
            onResizeEnd &&
            ((_e: unknown, p: { width: number; x?: number }) =>
              onResizeEnd(nodeId, p)),
          readOnly,
          onVoteWant: readOnly ? onVoteWant : undefined,
          onVoteDontWant: readOnly ? onVoteDontWant : undefined,
          userPreference: preferences?.get(shift.id) ?? null,
        },
        style: { width, height: SHIFT_NODE_HEIGHT },
        draggable: !readOnly,
        selectable: true,
        zIndex: Z_SHIFT_BLOCK,
      };
    });
}

export function useShiftNodes(
  shifts: ShiftLike[] | null,
  lanes: LaneConfig[],
  eventStart: Date | null,
  options?: UseShiftNodesOptions,
) {
  const {
    onResizeEnd,
    readOnly = false,
    onVoteWant,
    onVoteDontWant,
    selectedMemberId,
    preferences,
  } = options ?? {};
  return useMemo(() => {
    if (!shifts || !eventStart || lanes.length === 0) return [];
    return buildShiftNodes(shifts, lanes, eventStart, {
      onResizeEnd,
      readOnly,
      onVoteWant,
      onVoteDontWant,
      selectedMemberId,
      preferences,
    });
  }, [
    shifts,
    lanes,
    eventStart,
    onResizeEnd,
    readOnly,
    onVoteWant,
    onVoteDontWant,
    selectedMemberId,
    preferences,
  ]);
}
