"use client";

import { memo } from "react";
import { useViewport } from "@xyflow/react";
import { type LaneConfig } from "@/lib/types/lane";
import { LANE_HEIGHT } from "../utils/constants";

interface LaneLabelsColumnProps {
  lanes: LaneConfig[];
}

function LaneLabelsColumnComponent({ lanes }: LaneLabelsColumnProps) {
  const { zoom, y: viewportY } = useViewport();

  return (
    <div
      className="absolute left-0 top-0 z-10 bg-white border-r border-gray-200"
      style={{ width: 140 }}
    >
      {/* Spacer for time ruler */}
      <div style={{ height: 28, borderBottom: "1px solid #e5e7eb" }} />

      {lanes.map((lane, index) => {
        const screenY = index * LANE_HEIGHT * zoom + viewportY + 28;

        return (
          <div
            key={lane.id}
            className="absolute left-0 flex items-center gap-2 px-3"
            style={{
              top: screenY,
              height: LANE_HEIGHT * zoom,
              width: 140,
            }}
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: lane.color }}
            />
            <span className="text-xs font-medium text-gray-700 truncate">
              {lane.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const LaneLabelsColumn = memo(LaneLabelsColumnComponent);
