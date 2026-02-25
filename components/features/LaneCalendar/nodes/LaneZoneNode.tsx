"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { LANE_HEIGHT } from "../utils/constants";

export type LaneZoneData = {
  label: string;
  color: string;
  width: number; // total timeline width in px
};

function LaneZoneNodeComponent({ data }: NodeProps) {
  const { color, width } = data as LaneZoneData;

  // Convert hex to rgba for 10% opacity tint
  const tintColor = `${color}1A`;

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${LANE_HEIGHT}px`,
        backgroundColor: tintColor,
        backgroundImage: "var(--lane-stripe)",
      }}
      className="rounded-lg pointer-events-none"
    />
  );
}

export const LaneZoneNode = memo(LaneZoneNodeComponent);
