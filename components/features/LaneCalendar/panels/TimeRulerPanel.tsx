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
  MIN_HOUR_LABEL_WIDTH,
  MIN_DATE_LABEL_WIDTH,
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

  // Calculate how many hours to skip between labels to avoid overlap
  const pixelsPerHourAtZoom = PIXELS_PER_HOUR * zoom;
  const hourLabelSkip = Math.max(
    1,
    Math.ceil(MIN_HOUR_LABEL_WIDTH / pixelsPerHourAtZoom),
  );
  const dateLabelFits = pixelsPerHourAtZoom >= MIN_DATE_LABEL_WIDTH;

  for (let h = visibleStartHour; h <= visibleEndHour; h++) {
    const xBase = h * PIXELS_PER_HOUR;
    const time = addHours(eventStart, h);
    const isMidnight = time.getHours() === 0 && time.getMinutes() === 0;
    const showLabel = h % hourLabelSkip === 0;

    let label: string | undefined;
    if (showLabel) {
      const timeLabel = format(time, "HH:mm");
      if (isMidnight && dateLabelFits) {
        label = `${format(time, "EEE d MMM")} ${timeLabel}`;
      } else {
        label = timeLabel;
      }
    }

    // Hour tick (always show tick mark, label only when it fits)
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
                    left: "50%",
                    transform: "translateX(-50%)",
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
