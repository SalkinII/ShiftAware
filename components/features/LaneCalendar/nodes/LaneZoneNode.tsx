"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { LANE_HEIGHT, SHIFT_NODE_PADDING } from "../utils/constants";

export type LaneZoneData = {
  label: string;
  color: string;
  width: number; // total timeline width in px
};

function LaneZoneNodeComponent({ data }: NodeProps) {
  const { color, width } = data as LaneZoneData;

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${LANE_HEIGHT}px`,
        backgroundColor: color,
        opacity: 0.08,
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        pointerEvents: "none",
      }}
    />
  );
}

export const LaneZoneNode = memo(LaneZoneNodeComponent);
