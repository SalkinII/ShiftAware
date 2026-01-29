"use client";

import { useDndMonitor } from "@dnd-kit/core";
import { useState, useCallback } from "react";
import { format, differenceInMinutes } from "date-fns";
import { calculateTimeFromPosition, roundToInterval, calculateSnapPosition } from "@/lib/utils/snap";
import { getLaneColor } from "@/lib/types/lane";

interface DragPreviewProps {
  /** Duration of the dragged template in minutes */
  durationMinutes: number;
  /** Type of the dragged template (for color) */
  templateType: string;
}

interface PreviewState {
  visible: boolean;
  containerRect: DOMRect | null;
  dayStart: Date | null;
  dayEnd: Date | null;
  snapTargets: Date[];
  laneType: string | null;
  calculatedTime: Date | null;
  snapped: boolean;
}

export function DragPreview({ durationMinutes, templateType }: DragPreviewProps) {
  const [preview, setPreview] = useState<PreviewState>({
    visible: false,
    containerRect: null,
    dayStart: null,
    dayEnd: null,
    snapTargets: [],
    laneType: null,
    calculatedTime: null,
    snapped: false,
  });

  const handleDragMove = useCallback(
    (event: { active: any; over: any; activatorEvent: any }) => {
      const { over, activatorEvent } = event;

      if (!over || over.data.current?.type !== "lane") {
        setPreview((p) => ({ ...p, visible: false }));
        return;
      }

      const { dayStart, dayEnd, snapTargets, laneType } = over.data.current;
      const overNode = document.querySelector(`[data-testid="lane-drop-${over.data.current.date}-${laneType}"]`);

      if (!overNode) {
        setPreview((p) => ({ ...p, visible: false }));
        return;
      }

      const rect = overNode.getBoundingClientRect();
      const clientX = (activatorEvent as PointerEvent)?.clientX ?? 0;
      const relativeX = (clientX - rect.left) / rect.width;

      // Calculate time from position
      const rawTime = calculateTimeFromPosition(relativeX, new Date(dayStart), new Date(dayEnd));
      const roundedTime = roundToInterval(rawTime, 15);

      // Check for snap
      const snapResult = calculateSnapPosition(roundedTime, snapTargets, 30);

      setPreview({
        visible: true,
        containerRect: rect,
        dayStart: new Date(dayStart),
        dayEnd: new Date(dayEnd),
        snapTargets,
        laneType,
        calculatedTime: snapResult.time,
        snapped: snapResult.snapped,
      });
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setPreview((p) => ({ ...p, visible: false }));
  }, []);

  const handleDragCancel = useCallback(() => {
    setPreview((p) => ({ ...p, visible: false }));
  }, []);

  useDndMonitor({
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
    onDragCancel: handleDragCancel,
  });

  if (!preview.visible || !preview.calculatedTime || !preview.dayStart || !preview.dayEnd || !preview.containerRect) {
    return null;
  }

  const color = getLaneColor(templateType);
  const totalMinutes = differenceInMinutes(preview.dayEnd, preview.dayStart);
  const startMinutes = differenceInMinutes(preview.calculatedTime, preview.dayStart);
  const left = (startMinutes / totalMinutes) * 100;
  const width = (durationMinutes / totalMinutes) * 100;

  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{
        top: preview.containerRect.top,
        left: preview.containerRect.left,
        width: preview.containerRect.width,
        height: preview.containerRect.height,
      }}
    >
      {/* Ghost preview block */}
      <div
        className="absolute top-1 bottom-1 rounded-md border-2 border-dashed flex items-center justify-center text-xs font-bold"
        style={{
          left: `${left}%`,
          width: `${Math.max(width, 5)}%`,
          backgroundColor: `${color}30`,
          borderColor: preview.snapped ? color : `${color}80`,
          color: color,
        }}
      >
        {format(preview.calculatedTime, "HH:mm")}
        {preview.snapped && <span className="ml-1">⚡</span>}
      </div>

      {/* Snap indicator line */}
      {preview.snapped && (
        <div
          className="absolute top-0 bottom-0 w-0.5"
          style={{
            left: `${left}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      )}
    </div>
  );
}
