"use client";

import { CellState } from "../hooks/useCellState";
import { CAN_ASSIGN_REASON_LABELS, CanAssignResult } from "@/lib/algorithm/can-assign";

const CELL_STYLES: Record<CellState, string> = {
  blocked: "bg-red-100 text-red-400 cursor-not-allowed",
  eligible: "bg-gray-100 hover:bg-gray-200 cursor-pointer",
  preferred: "bg-green-100 hover:bg-green-200 cursor-pointer",
  assigned: "bg-blue-200 hover:bg-blue-300 cursor-pointer",
  conflict: "bg-orange-200 hover:bg-orange-300 cursor-pointer",
};

const CELL_ICONS: Record<CellState, string> = {
  blocked: "✗",
  eligible: "·",
  preferred: "★",
  assigned: "■",
  conflict: "▲",
};

interface Props {
  state: CellState;
  reason?: NonNullable<CanAssignResult["reason"]>;
  memberId: string;
  shiftId: string;
  selected: boolean;
  onToggle: (
    memberId: string,
    shiftId: string,
    currentState: CellState,
    reason?: NonNullable<CanAssignResult["reason"]>,
  ) => void;
}

export function HeatmapCell({
  state,
  reason,
  memberId,
  shiftId,
  selected,
  onToggle,
}: Props) {
  const title = reason ? `${state} — ${CAN_ASSIGN_REASON_LABELS[reason]}` : state;
  return (
    <button
      className={`w-8 h-8 text-xs flex items-center justify-center border rounded
        ${CELL_STYLES[state]}
        ${selected ? "ring-2 ring-blue-500" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(memberId, shiftId, state, reason);
      }}
      title={title}
    >
      {CELL_ICONS[state]}
    </button>
  );
}
