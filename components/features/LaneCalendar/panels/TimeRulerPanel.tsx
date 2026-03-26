"use client";

import { memo } from "react";
import { Panel } from "@xyflow/react";
import { format, addHours, differenceInHours, startOfDay } from "date-fns";
import {
  PIXELS_PER_HOUR,
  RULER_HEIGHT,
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
  // eslint-disable-next-line react-hooks/rules-of-hooks -- hook is at top level, not in loop; linter false positive
  const { flowToScreenX, zoom } = useScreenCoordinates();

  const totalHours = differenceInHours(eventEnd, eventStart) + 24;

  // Calculate offset from midnight to event start (for 00:00 tick visibility)
  const midnightStart = startOfDay(eventStart);
  const preEventHours = differenceInHours(eventStart, midnightStart);

  // Determine tick density based on zoom
  const show15min = zoom > ZOOM_COMPACT;
  const show30min = zoom > ZOOM_MINIMAL;

  // Calculate which hours are visible in viewport
  const pixelsPerHourAtZoom = PIXELS_PER_HOUR * zoom;
  const adjustedStartHour = Math.max(
    -preEventHours,
    Math.floor(-flowToScreenX(0) / pixelsPerHourAtZoom) - preEventHours,
  );
  const visibleEndHour = Math.min(
    totalHours,
    Math.ceil((-flowToScreenX(0) + window.innerWidth) / pixelsPerHourAtZoom) +
      1,
  );

  const ticks: {
    x: number;
    label?: string;
    height: number;
  }[] = [];

  const hourLabelSkip = Math.max(
    1,
    Math.ceil(MIN_HOUR_LABEL_WIDTH / pixelsPerHourAtZoom),
  );

  for (let h = adjustedStartHour; h <= visibleEndHour; h++) {
    const xBase = h * PIXELS_PER_HOUR;
    const time = addHours(midnightStart, preEventHours + h);
    const showLabel = h % hourLabelSkip === 0;

    ticks.push({
      x: xBase,
      label: showLabel ? format(time, "HH:mm") : undefined,
      height: TICK_HEIGHT_HOUR,
    });

    if (show30min && !show15min) {
      ticks.push({
        x: xBase + PIXELS_PER_HOUR / 2,
        height: TICK_HEIGHT_30MIN,
      });
    }

    if (show15min) {
      ticks.push({
        x: xBase + PIXELS_PER_HOUR / 4,
        height: TICK_HEIGHT_15MIN,
      });
      ticks.push({
        x: xBase + PIXELS_PER_HOUR / 2,
        height: TICK_HEIGHT_30MIN,
      });
      ticks.push({
        x: xBase + (PIXELS_PER_HOUR * 3) / 4,
        height: TICK_HEIGHT_15MIN,
      });
    }
  }

  // Build day segments for the day tier
  const daySegments: { startX: number; width: number; label: string }[] = [];
  const totalDays = Math.ceil(differenceInHours(eventEnd, eventStart) / 24) + 2;
  for (let d = -1; d <= totalDays; d++) {
    const dayMidnight = startOfDay(addHours(eventStart, d * 24));
    const nextMidnight = startOfDay(addHours(eventStart, (d + 1) * 24));
    const startFlowX =
      differenceInHours(dayMidnight, eventStart) * PIXELS_PER_HOUR;
    const endFlowX =
      differenceInHours(nextMidnight, eventStart) * PIXELS_PER_HOUR;
    const startScreenX = flowToScreenX(startFlowX);
    const endScreenX = flowToScreenX(endFlowX);
    if (endScreenX < 0 || startScreenX > window.innerWidth) continue;
    daySegments.push({
      startX: Math.max(0, startScreenX),
      width: endScreenX - Math.max(0, startScreenX),
      label: format(
        dayMidnight,
        zoom > ZOOM_MINIMAL ? "EEE dd.MM.yyyy" : "dd.MM.yy",
      ),
    });
  }

  return (
    <Panel
      position="top-left"
      className="pointer-events-none"
      style={{ margin: 0, padding: 0 }}
    >
      <div
        style={{
          height: RULER_HEIGHT,
          position: "relative",
          overflow: "hidden",
          width: "100vw",
          backgroundColor: "rgba(255,255,255,0.9)",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        {/* Day tier — top 20px */}
        {daySegments.map((seg, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: seg.startX,
              width: seg.width,
              top: 0,
              height: 20,
              borderRight: "1px solid #d1d5db",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                i % 2 === 0 ? "rgba(241,245,249,0.7)" : "transparent",
            }}
          >
            <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">
              {seg.label}
            </span>
          </div>
        ))}

        {/* Hour tick tier — bottom 28px */}
        {ticks.map((tick, i) => {
          const screenX = flowToScreenX(tick.x);
          if (screenX < -50 || screenX > window.innerWidth + 50) return null;

          return (
            <div
              key={`t${i}`}
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
                  className="text-xs text-gray-500 whitespace-nowrap"
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
