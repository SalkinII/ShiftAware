"use client";

import { memo } from "react";
import { Panel, useViewport, useReactFlow } from "@xyflow/react";
import { format, addHours, differenceInHours } from "date-fns";
import {
  PIXELS_PER_HOUR,
  ZOOM_MINIMAL,
  ZOOM_COMPACT,
  TICK_HEIGHT_HOUR,
  TICK_HEIGHT_30MIN,
  TICK_HEIGHT_15MIN,
} from "../utils/constants";

interface TimeRulerPanelProps {
  eventStart: Date;
  eventEnd: Date;
}

function TimeRulerPanelComponent({
  eventStart,
  eventEnd,
}: TimeRulerPanelProps) {
  const { zoom, x: viewportX } = useViewport();

  const totalHours = differenceInHours(eventEnd, eventStart) + 24;

  // Determine tick density based on zoom
  const show15min = zoom > ZOOM_COMPACT;
  const show30min = zoom > ZOOM_MINIMAL;

  // Only render ticks visible in viewport (performance)
  const visibleStartHour = Math.max(
    0,
    Math.floor(-viewportX / (PIXELS_PER_HOUR * zoom)),
  );
  const visibleEndHour = Math.min(
    totalHours,
    Math.ceil((-viewportX + window.innerWidth) / (PIXELS_PER_HOUR * zoom)) + 1,
  );

  const ticks: { x: number; label?: string; height: number }[] = [];

  for (let h = visibleStartHour; h <= visibleEndHour; h++) {
    const xBase = h * PIXELS_PER_HOUR;
    const time = addHours(eventStart, h);
    const isMidnight = time.getHours() === 0 && time.getMinutes() === 0;
    const dateLabel = isMidnight ? format(time, "EEE d MMM") : "";
    const timeLabel = format(time, "HH:mm");
    const label = isMidnight ? `${dateLabel} ${timeLabel}` : timeLabel;

    // Hour tick (add date at midnight for multi-day context)
    ticks.push({
      x: xBase,
      label,
      height: TICK_HEIGHT_HOUR,
    });

    // Sub-hour ticks
    if (show30min && !show15min) {
      ticks.push({ x: xBase + PIXELS_PER_HOUR / 2, height: TICK_HEIGHT_30MIN });
    }

    if (show15min) {
      ticks.push({ x: xBase + PIXELS_PER_HOUR / 4, height: TICK_HEIGHT_15MIN });
      ticks.push({ x: xBase + PIXELS_PER_HOUR / 2, height: TICK_HEIGHT_30MIN });
      ticks.push({
        x: xBase + (PIXELS_PER_HOUR * 3) / 4,
        height: TICK_HEIGHT_15MIN,
      });
    }
  }

  return (
    <Panel position="top-left" className="pointer-events-none m-0 p-0">
      <div
        style={{
          height: 28,
          position: "relative",
          overflow: "hidden",
          width: "100vw",
          backgroundColor: "rgba(255,255,255,0.9)",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        {ticks.map((tick, i) => {
          const screenX = tick.x * zoom + viewportX;
          if (screenX < -50 || screenX > window.innerWidth + 50) return null;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: screenX,
                bottom: 0,
                transform: "translateX(-50%)",
              }}
            >
              <div
                style={{
                  width: 1,
                  height: tick.height,
                  backgroundColor: "#9ca3af",
                }}
              />
              {tick.label && (
                <div
                  className="text-[9px] text-gray-500 whitespace-nowrap"
                  style={{
                    position: "absolute",
                    bottom: tick.height + 2,
                    left: 4,
                  }}
                >
                  {tick.label}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export const TimeRulerPanel = memo(TimeRulerPanelComponent);
