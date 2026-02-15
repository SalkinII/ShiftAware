"use client";

import { memo } from "react";
import { type NodeProps, useViewport } from "@xyflow/react";
import { DAY_SEPARATOR_WIDTH } from "../utils/constants";

export type DaySeparatorData = {
  label: string; // e.g. "12 Feb 2026"
  height: number; // total canvas height in px
};

function DaySeparatorNodeComponent({ data }: NodeProps) {
  const { label, height } = data as DaySeparatorData;
  const { zoom } = useViewport();

  return (
    <div
      style={{
        width: `${DAY_SEPARATOR_WIDTH}px`,
        height: `${height}px`,
        position: "relative",
        pointerEvents: "none",
      }}
    >
      {/* Bold vertical line */}
      <div
        style={{
          width: 3,
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      />
      {/* Counter-scaled day label — stays readable at any zoom */}
      <div
        style={{
          position: "absolute",
          top: -28 / zoom,
          left: 6 / zoom,
          transform: `scale(${1 / zoom})`,
          transformOrigin: "left top",
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
