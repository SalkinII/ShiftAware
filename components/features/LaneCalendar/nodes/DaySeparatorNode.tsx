"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { DAY_SEPARATOR_WIDTH } from "../utils/constants";

export type DaySeparatorData = {
  label: string; // e.g. "Fri 26 Jun"
  height: number; // total canvas height in px
};

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
      {/* Vertical line */}
      <div
        style={{
          width: "1px",
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.3)",
        }}
      />
      {/* Day label */}
      <div className="absolute -top-6 left-2 text-xs font-medium text-gray-500 whitespace-nowrap">
        {label}
      </div>
    </div>
  );
}

export const DaySeparatorNode = memo(DaySeparatorNodeComponent);
