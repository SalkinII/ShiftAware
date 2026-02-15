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
          onResizeEnd={onResizeEnd}
        />
      )}
      <div
        style={{
          width: `${width}px`,
          height: `${SHIFT_NODE_HEIGHT}px`,
          backgroundColor: color,
          opacity: isFull ? 1 : 0.8,
          borderRadius: "6px",
          border: selected ? "2px solid #1d4ed8" : "1px solid rgba(0,0,0,0.1)",
          overflow: "hidden",
          cursor: "grab",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: isMinimal ? "0" : "4px 8px",
        }}
        className="transition-shadow"
      >
        {/* Minimal: just a colored bar */}
        {isMinimal ? null : isCompact ? (
          /* Compact: name + optional vote buttons */
          <div className="flex items-center justify-between gap-1 w-full">
            <div className="text-base font-medium text-white truncate drop-shadow-sm min-w-0">
              {templateName}
            </div>
            {readOnly && (onVoteWant || onVoteDontWant) && (
              <div className="flex gap-0.5 shrink-0">
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
