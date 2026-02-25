"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { DAY_SEPARATOR_WIDTH } from "../utils/constants";

export type DaySeparatorData = {
  label: string;
  height: number;
};

function DaySeparatorNodeComponent({ data }: NodeProps) {
  const { height } = data as DaySeparatorData;

  return (
    <div
      style={{
        width: `${DAY_SEPARATOR_WIDTH}px`,
        height: `${height}px`,
        position: "relative",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 1,
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      />
    </div>
  );
}

export const DaySeparatorNode = memo(DaySeparatorNodeComponent);
