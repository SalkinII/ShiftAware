"use client";

import { memo } from "react";
import { Panel } from "@xyflow/react";
import { type LaneConfig } from "@/lib/types/lane";
import {
  LANE_HEIGHT,
  LANE_LABEL_WIDTH,
  RULER_HEIGHT,
} from "../utils/constants";
import { useScreenCoordinates } from "../hooks/useScreenCoordinates";
import { abbreviateLaneName } from "../utils/laneName";

interface LaneLabelPanelProps {
  lanes: LaneConfig[];
  canvasHeight: number;
}

function LaneLabelPanelComponent({ lanes, canvasHeight }: LaneLabelPanelProps) {
  const { flowToScreenY } = useScreenCoordinates();

  return (
    <Panel
      position="top-left"
      className="pointer-events-none"
      style={{ margin: 0, padding: 0 }}
    >
      {/* Spacer to clear time ruler */}
      <div style={{ height: RULER_HEIGHT }} />
      <div
        style={{
          position: "relative",
          width: LANE_LABEL_WIDTH,
          height: canvasHeight,
          backgroundColor: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(10px)",
          borderRight: "1px solid #e5e7eb",
        }}
      >
        {lanes.map((lane, index) => {
          // Center of this lane row in viewport Y; convert to container-relative
          const centerY = flowToScreenY((index + 0.5) * LANE_HEIGHT);
          const localY = Math.round(centerY - RULER_HEIGHT);
          if (localY < 0 || localY > canvasHeight) return null;

          return (
            <div
              key={lane.id}
              style={{
                position: "absolute",
                top: localY,
                transform: "translateY(-50%)",
                left: 0,
                right: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 4,
                paddingLeft: 8,
                paddingRight: 4,
              }}
            >
              {/* Lane color accent bar */}
              <div
                style={{
                  width: 3,
                  height: 20,
                  borderRadius: 2,
                  backgroundColor: lane.color,
                  flexShrink: 0,
                }}
              />
              {/* Abbreviated lane name */}
              <span
                className="text-xs text-gray-500 font-medium truncate"
                style={{ maxWidth: LANE_LABEL_WIDTH - 16 }}
              >
                {abbreviateLaneName(lane.label)}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export const LaneLabelPanel = memo(LaneLabelPanelComponent);
