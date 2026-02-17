"use client";

import { memo } from "react";
import { type NodeProps, useViewport, NodeResizer } from "@xyflow/react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { format } from "date-fns";
import {
  ZOOM_MINIMAL,
  ZOOM_COMPACT,
  SHIFT_NODE_HEIGHT,
  SNAP_PIXELS,
} from "../utils/constants";

export type ShiftBlockData = {
  shiftId: string;
  templateName: string;
  type: string;
  color: string;
  startTime: string; // ISO
  endTime: string; // ISO
  capacity: number;
  assignmentCount: number;
  width: number; // calculated width in px
  desirabilityScore?: number; // 1-5
  assignedMembers?: Array<{ alias: string; avatarId: string }>;
  currentMemberId?: string;
  isAssignedToCurrentUser?: boolean;
  onResizeEnd?: (e: unknown, p: { width: number }) => void | Promise<void>;
  readOnly?: boolean;
  onVoteWant?: (shiftId: string) => void;
  onVoteDontWant?: (shiftId: string) => void;
};

function ShiftBlockNodeComponent({ data, selected }: NodeProps) {
  const {
    shiftId,
    templateName,
    color,
    startTime,
    endTime,
    capacity,
    assignmentCount,
    width,
    desirabilityScore,
    assignedMembers,
    isAssignedToCurrentUser,
    onResizeEnd,
    readOnly,
    onVoteWant,
    onVoteDontWant,
  } = data as ShiftBlockData;

  const { zoom } = useViewport();

  const isFull = assignmentCount >= capacity;

  // Semantic zoom levels
  const isMinimal = zoom < ZOOM_MINIMAL;
  const isCompact = zoom < ZOOM_COMPACT;

  return (
    <>
      {!readOnly && (
        <NodeResizer
          isVisible={selected}
          minWidth={SNAP_PIXELS}
          handleStyle={{ width: 8, height: 24, borderRadius: 2 }}
          lineStyle={{ borderWidth: 0 }}
          keepAspectRatio={false}
          onResizeEnd={(e, p) => {
            try {
              const result = onResizeEnd?.(e, p);
              if (result instanceof Promise) {
                result.catch((err) => console.error("Resize failed:", err));
              }
            } catch (err) {
              console.error("Resize failed:", err);
            }
          }}
        />
      )}
      <div
        style={{
          width: `${width}px`,
          height: `${SHIFT_NODE_HEIGHT}px`,
          backgroundColor: color,
          opacity: isFull ? 1 : 0.8,
          borderRadius: `${Math.ceil(6 / zoom)}px`,
          borderStyle: "solid",
          borderColor: isAssignedToCurrentUser
            ? "#16a34a"
            : selected
              ? "#1d4ed8"
              : `color-mix(in srgb, ${color} 70%, black)`,
          borderWidth: isAssignedToCurrentUser
            ? `${Math.ceil(3 / zoom)}px`
            : `${Math.ceil(2 / zoom)}px`,
          overflow: "hidden",
          cursor: "grab",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: isMinimal ? "0" : "4px 8px",
        }}
        className="transition-shadow"
      >
        {isMinimal ? (
          /* Minimal: counter-scaled name */
          <div
            style={{
              transform: `scale(${1 / zoom})`,
              transformOrigin: "left center",
              width: width * zoom,
              overflow: "hidden",
            }}
          >
            <div className="text-xs font-medium text-white truncate drop-shadow-sm px-1">
              {templateName}
            </div>
          </div>
        ) : isCompact ? (
          /* Compact: counter-scaled name + time range */
          <div
            style={{
              transform: `scale(${1 / zoom})`,
              transformOrigin: "left center",
              width: width * zoom,
              overflow: "hidden",
            }}
          >
            <div className="text-xs font-medium text-white truncate drop-shadow-sm px-1">
              {templateName}
            </div>
            <div className="text-[10px] text-white/80 truncate px-1">
              {format(new Date(startTime), "HH:mm")}–
              {format(new Date(endTime), "HH:mm")}
            </div>
            <div className="text-[10px] text-white/80 px-1">
              {assignmentCount}/{capacity}
            </div>
            {assignedMembers && assignedMembers.length > 0 && (
              <div className="text-[9px] text-white/70 truncate px-1">
                {assignedMembers
                  .slice(0, 3)
                  .map((m) => m.alias)
                  .join(", ")}
                {assignedMembers.length > 3 &&
                  ` +${assignedMembers.length - 3}`}
              </div>
            )}
            {desirabilityScore != null && (
              <span
                className="inline-flex px-1 py-0.5 rounded text-[9px] font-bold mt-0.5"
                style={{
                  backgroundColor:
                    desirabilityScore <= 2
                      ? "rgba(59, 130, 246, 0.3)"
                      : desirabilityScore === 3
                        ? "rgba(156, 163, 175, 0.3)"
                        : "rgba(249, 115, 22, 0.3)",
                  color: "white",
                }}
              >
                {desirabilityScore}/5
              </span>
            )}
            {readOnly && (onVoteWant || onVoteDontWant) && (
              <div className="flex gap-0.5 shrink-0 px-1 mt-0.5">
                {onVoteWant && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onVoteWant(shiftId);
                    }}
                    className="p-0.5 rounded bg-white/20 hover:bg-white/30"
                    aria-label="Want this shift"
                  >
                    <ThumbsUp className="w-3 h-3" />
                  </button>
                )}
                {onVoteDontWant && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onVoteDontWant(shiftId);
                    }}
                    className="p-0.5 rounded bg-white/20 hover:bg-white/30"
                    aria-label="Don't want this shift"
                  >
                    <ThumbsDown className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Full detail */
          <>
            <div className="text-lg font-semibold text-white truncate drop-shadow-sm">
              {templateName}
            </div>
            <div className="text-base text-white/80 truncate">
              {format(new Date(startTime), "HH:mm")} –{" "}
              {format(new Date(endTime), "HH:mm")}
            </div>
            <div className="text-base text-white/80">
              {assignmentCount}/{capacity}
            </div>
            {assignedMembers && assignedMembers.length > 0 && !isMinimal && (
              <div className="flex flex-wrap gap-0.5 mt-1">
                {assignedMembers.slice(0, 4).map((m) => (
                  <span
                    key={m.alias}
                    className="text-[10px] bg-white/20 px-1 rounded truncate max-w-[60px]"
                    title={m.alias}
                  >
                    {m.alias}
                  </span>
                ))}
                {assignedMembers.length > 4 && (
                  <span className="text-[10px] text-white/60">
                    +{assignedMembers.length - 4}
                  </span>
                )}
              </div>
            )}
            {desirabilityScore != null && (
              <div
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold mt-1"
                style={{
                  backgroundColor:
                    desirabilityScore <= 2
                      ? "rgba(59, 130, 246, 0.3)"
                      : desirabilityScore === 3
                        ? "rgba(156, 163, 175, 0.3)"
                        : "rgba(249, 115, 22, 0.3)",
                  color: "white",
                }}
                title={`Desirability: ${desirabilityScore}/5 — ${desirabilityScore <= 2 ? "easier to get" : desirabilityScore >= 4 ? "harder to get" : "moderate"}`}
              >
                {desirabilityScore}/5
              </div>
            )}
            {readOnly && (onVoteWant || onVoteDontWant) && (
              <div className="flex gap-1 mt-1">
                {onVoteWant && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onVoteWant(shiftId);
                    }}
                    className="p-1 rounded bg-white/20 hover:bg-white/30 transition-colors"
                    title="Want this shift"
                    aria-label="Want this shift"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                )}
                {onVoteDontWant && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onVoteDontWant(shiftId);
                    }}
                    className="p-1 rounded bg-white/20 hover:bg-white/30 transition-colors"
                    title="Don't want this shift"
                    aria-label="Don't want this shift"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export const ShiftBlockNode = memo(ShiftBlockNodeComponent);
