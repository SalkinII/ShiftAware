"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";

export type HourGridData = {
  height: number; // total canvas height in px
};

function HourGridNodeComponent({ data }: NodeProps) {
  const { height } = data as HourGridData;

  return (
    <div
      style={{
        width: 1,
        height: `${height}px`,
        borderLeft: "1px dashed rgba(0,0,0,0.08)",
        pointerEvents: "none",
      }}
    />
  );
}

export const HourGridNode = memo(HourGridNodeComponent);
