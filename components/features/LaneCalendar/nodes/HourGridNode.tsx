"use client";

import { memo } from "react";
import { type NodeProps, useViewport } from "@xyflow/react";

export type HourGridData = {
  height: number; // total canvas height in px
};

function HourGridNodeComponent({ data }: NodeProps) {
  const { height } = data as HourGridData;
  const { zoom } = useViewport();

  return (
    <div
      style={{
        width: 1,
        height: `${height}px`,
        borderLeft: `${Math.ceil(1 / zoom)}px dashed rgba(0,0,0,0.08)`,
        pointerEvents: "none",
      }}
    />
  );
}

export const HourGridNode = memo(HourGridNodeComponent);
