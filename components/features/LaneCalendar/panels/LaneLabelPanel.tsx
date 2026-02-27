"use client";

import { memo } from "react";
import { Panel } from "@xyflow/react";
import { type LaneConfig, UNASSIGNED_LANE_ID } from "@/lib/types/lane";
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
  onReorder?: (laneId: string, direction: "up" | "down") => void;
}

function LaneLabelPanelComponent({
  lanes,
  canvasHeight,
  onReorder,
}: LaneLabelPanelProps) {
  const { flowToScreenY } = useScreenCoordinates();
  const sortableLanes = lanes.filter((l) => l.id !== UNASSIGNED_LANE_ID);

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
          const centerY = flowToScreenY((index + 0.5) * LANE_HEIGHT);
          const localY = Math.round(centerY - RULER_HEIGHT);
          if (localY < 0 || localY > canvasHeight) return null;

          const isSortable = lane.id !== UNASSIGNED_LANE_ID;
          const sortableIndex = sortableLanes.indexOf(lane);
          const canMoveUp = isSortable && sortableIndex > 0;
          const canMoveDown =
            isSortable && sortableIndex < sortableLanes.length - 1;

          return (
            <div
              key={lane.id}
              className="group"
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
                paddingLeft: 4,
                paddingRight: 4,
              }}
            >
              {/* Reorder buttons — only for sortable lanes, visible on hover */}
              {onReorder && isSortable && (
                <div
                  className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
                  style={{ gap: 0, flexShrink: 0 }}
                >
                  <button
                    onClick={() => onReorder(lane.id, "up")}
                    disabled={!canMoveUp}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-default leading-none text-[9px]"
                    title="Move lane up"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => onReorder(lane.id, "down")}
                    disabled={!canMoveDown}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-default leading-none text-[9px]"
                    title="Move lane down"
                  >
                    ▼
                  </button>
                </div>
              )}
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
                className="text-xs text-gray-500 font-medium truncate pointer-events-auto"
                style={{ maxWidth: LANE_LABEL_WIDTH - 32 }}
                title={lane.label}
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
