"use client";

import { memo } from "react";
import { type NodeProps, useViewport } from "@xyflow/react";
import { LANE_HEIGHT } from "../utils/constants";

export type LaneZoneData = {
  label: string;
  color: string;
  width: number; // total timeline width in px
};

function LaneZoneNodeComponent({ data }: NodeProps) {
  const { color, width } = data as LaneZoneData;
  const { zoom } = useViewport();
  const tintColor = `${color}1A`;
  const borderWidth = Math.max(1, Math.ceil(1 / zoom));

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${LANE_HEIGHT}px`,
        backgroundColor: tintColor,
        backgroundImage: "var(--lane-stripe)",
        borderBottom: `${borderWidth}px solid rgba(0,0,0,0.06)`,
      }}
      className="rounded-lg pointer-events-none"
    />
  );
}

export const LaneZoneNode = memo(LaneZoneNodeComponent);
