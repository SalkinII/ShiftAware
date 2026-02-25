"use client";

import { memo } from "react";
import { Panel } from "@xyflow/react";
import { format, addHours, differenceInHours } from "date-fns";
import {
  PIXELS_PER_HOUR,
  ZOOM_MINIMAL,
  ZOOM_COMPACT,
  TICK_HEIGHT_HOUR,
  TICK_HEIGHT_30MIN,
  TICK_HEIGHT_15MIN,
  MIN_HOUR_LABEL_WIDTH,
} from "../utils/constants";
import { useScreenCoordinates } from "../hooks/useScreenCoordinates";

interface TimeRulerPanelProps {
  eventStart: Date;
  eventEnd: Date;
}

function TimeRulerPanelComponent({
  eventStart,
  eventEnd,
}: TimeRulerPanelProps) {
  const { flowToScreenX, zoom } = useScreenCoordinates();

  const totalHours = differenceInHours(eventEnd, eventStart) + 24;

  // Determine tick density based on zoom
  const show15min = zoom > ZOOM_COMPACT;
  const show30min = zoom > ZOOM_MINIMAL;

  // Calculate which hours are visible in viewport
  const pixelsPerHourAtZoom = PIXELS_PER_HOUR * zoom;
  const visibleStartHour = Math.max(
    0,
    Math.floor(-flowToScreenX(0) / pixelsPerHourAtZoom),
  );
  const visibleEndHour = Math.min(
    totalHours,
    Math.ceil((-flowToScreenX(0) + window.innerWidth) / pixelsPerHourAtZoom) + 1,
  );

  const ticks: { x: number; label?: string; dayLabel?: string; height: number }[] = [];

  // Calculate how many hours to skip between labels to avoid overlap
  const hourLabelSkip = Math.max(
    1,
    Math.ceil(MIN_HOUR_LABEL_WIDTH / pixelsPerHourAtZoom),
  );
  for (let h = visibleStartHour; h <= visibleEndHour; h++) {
    const xBase = h * PIXELS_PER_HOUR;
    const time = addHours(eventStart, h);
    const isMidnight = time.getHours() === 0 && time.getMinutes() === 0;
    const showLabel = h % hourLabelSkip === 0;

    let label: string | undefined;
    let dayLabel: string | undefined;

    if (showLabel) {
      label = format(time, "HH:mm");
    }

    if (isMidnight) {
      // Always show day label at midnight (zoom determines short vs long format)
      dayLabel =
        zoom > 0.3 ? format(time, "EEE d MMM") : format(time, "d MMM");
    }

    // Hour tick (always show tick mark, label only when it fits)
    ticks.push({
      x: xBase,
      label,
      dayLabel,
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
          // Use centralized coordinate transform
          const screenX = flowToScreenX(tick.x);
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
              {tick.dayLabel && (
                <div
                  className="text-[10px] font-bold text-gray-700 whitespace-nowrap"
                  style={{
                    position: "absolute",
                    top: 15,
                    left: "50%",
                    transform: "translateX(-50%)",
                    backgroundColor: "rgba(255,255,255,0.85)",
                    padding: "0 4px",
                    borderRadius: 2,
                  }}
                >
                  {tick.dayLabel}
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
