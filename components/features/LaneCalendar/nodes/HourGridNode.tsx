"use client";

import { memo } from "react";
import { type NodeProps, useViewport } from "@xyflow/react";

export type HourGridData = {
  height: number; // total canvas height in px
};

function HourGridNodeComponent({ data }: NodeProps) {
  const { height } = data as HourGridData;
  const { zoom } = useViewport();

  const borderWidth = Math.max(1, Math.ceil(1 / zoom));
  return (
    <div
      style={{
        width: borderWidth,
        height: `${height}px`,
        borderLeft: `${borderWidth}px dashed rgba(0,0,0,0.15)`,
        pointerEvents: "none",
      }}
    />
  );
}

export const HourGridNode = memo(HourGridNodeComponent);
