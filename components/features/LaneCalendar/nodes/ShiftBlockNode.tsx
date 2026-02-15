"use client";

import { memo, useCallback } from "react";
import { type NodeProps, useViewport } from "@xyflow/react";
import { NodeResizer } from "@reactflow/node-resizer";
import "@reactflow/node-resizer/dist/style.css";
import { format } from "date-fns";
import { ZOOM_MINIMAL, ZOOM_COMPACT, SHIFT_NODE_HEIGHT, SNAP_PIXELS } from "../utils/constants";

export type ShiftBlockData = {
  shiftId: string;
  templateName: string;
  type: string;
  color: string;
  startTime: string; // ISO
  endTime: string;   // ISO
  capacity: number;
  assignmentCount: number;
  width: number;     // calculated width in px
};

function ShiftBlockNodeComponent({ data, selected }: NodeProps) {
  const {
    templateName,
    color,
    startTime,
    endTime,
    capacity,
    assignmentCount,
    width,
  } = data as ShiftBlockData;

  const { zoom } = useViewport();

  const isFull = assignmentCount >= capacity;

  // Semantic zoom levels
  const isMinimal = zoom < ZOOM_MINIMAL;
  const isCompact = zoom < ZOOM_COMPACT;

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={SNAP_PIXELS}
        handleStyle={{ width: 8, height: 24, borderRadius: 2 }}
        lineStyle={{ borderWidth: 0 }}
        // Only allow horizontal resize (left/right handles)
        keepAspectRatio={false}
      />
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
          /* Compact: name only */
          <div className="text-xs font-medium text-white truncate drop-shadow-sm">
            {templateName}
          </div>
        ) : (
          /* Full detail */
          <>
            <div className="text-xs font-semibold text-white truncate drop-shadow-sm">
              {templateName}
            </div>
            <div className="text-[10px] text-white/80 truncate">
              {format(new Date(startTime), "HH:mm")} – {format(new Date(endTime), "HH:mm")}
            </div>
            <div className="text-[10px] text-white/80">
              {assignmentCount}/{capacity}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export const ShiftBlockNode = memo(ShiftBlockNodeComponent);
