"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { DAY_SEPARATOR_WIDTH } from "../utils/constants";

export type DaySeparatorData = {
  label: string; // e.g. "12 Feb 2026"
  height: number; // total canvas height in px
};

const TIME_RULER_HEIGHT = 28; // Matches TimeRulerPanel height

function DaySeparatorNodeComponent({ data }: NodeProps) {
  const { label, height } = data as DaySeparatorData;

  return (
    <div
      style={{
        width: `${DAY_SEPARATOR_WIDTH}px`,
        height: `${height}px`,
        position: "relative",
        pointerEvents: "none",
      }}
    >
      {/* Bold vertical line — constant 1px (appears thicker at zoom because node scales) */}
      <div
        style={{
          width: 1,
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      />
      {/* Day label — fixed pixel offset above node, no zoom scaling */}
      <div
        style={{
          position: "absolute",
          // Fixed offset above the time ruler (don't scale with zoom)
          top: -TIME_RULER_HEIGHT,
          left: 4,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#374151",
            backgroundColor: "rgba(255,255,255,0.85)",
            padding: "1px 6px",
            borderRadius: 3,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export const DaySeparatorNode = memo(DaySeparatorNodeComponent);
