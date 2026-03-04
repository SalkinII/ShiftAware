"use client";

import { memo, useRef, useState, useEffect } from "react";
import { type NodeProps, NodeResizer } from "@xyflow/react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SNAP_PIXELS } from "../utils/constants";
import { DesirabilityBadge } from "@/components/ui/DesirabilityBadge";

export type ShiftBlockData = {
  shiftId: string;
  templateName: string;
  type: string;
  color: string;
  startTime: string;
  endTime: string;
  capacity: number;
  assignmentCount: number;
  desirabilityScore?: number;
  assignedMembers?: Array<{ alias: string; avatarId?: string }>;
  currentMemberId?: string;
  isAssignedToCurrentUser?: boolean;
  onResizeEnd?: (nodeId: string, p: { width: number; x?: number }) => void | Promise<void>;
  readOnly?: boolean;
  onVoteWant?: (shiftId: string) => void;
  onVoteDontWant?: (shiftId: string) => void;
};

/** Minimum screen-pixel thresholds for progressive content reveal */
const W_NAMES = 40;   // show member names
const W_TIME = 100;   // add time range
const W_STARS = 130;  // add desirability stars
const H_ROW2 = 20;    // show second row (stars + votes)
const H_ROW3 = 38;    // show third row (avatars + names)

function ShiftContent({
  shiftId,
  templateName,
  startTime,
  endTime,
  assignmentCount,
  capacity,
  desirabilityScore,
  assignedMembers,
  readOnly,
  onVoteWant,
  onVoteDontWant,
}: {
  shiftId: string;
  templateName: string;
  startTime: string;
  endTime: string;
  assignmentCount: number;
  capacity: number;
  desirabilityScore?: number;
  assignedMembers?: Array<{ alias: string; avatarId?: string }>;
  readOnly?: boolean;
  onVoteWant?: (shiftId: string) => void;
  onVoteDontWant?: (shiftId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mW, setMW] = useState(0);
  const [mH, setMH] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setMW(entry.contentRect.width);
      setMH(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isMarker = capacity === 0;

  const showNames = mW >= W_NAMES;
  const showTime = mW >= W_TIME;
  const showStars = mW >= W_STARS && desirabilityScore != null;
  const showRow2 = mH >= H_ROW2;
  const showRow3 = mH >= H_ROW3;

  return (
    <div
      ref={containerRef}
      className="h-full w-full flex flex-col px-[16px] py-[8px] gap-[8px] overflow-hidden"
    >
      {/* Row 1: name (left) + time (right) */}
      {showNames && (
        <div className="flex justify-between items-center gap-2 min-w-0">
          <span className={cn(
            "truncate font-semibold min-w-0 text-[100px] leading-[1.15]",
            isMarker ? "text-gray-400" : "text-gray-900"
          )}>
            {templateName}
          </span>
          {showTime && !isMarker && (
            <span className="text-[100px] leading-[1.15] text-gray-500 whitespace-nowrap flex-shrink-0">
              {format(new Date(startTime), "HH:mm")}–{format(new Date(endTime), "HH:mm")}
            </span>
          )}
        </div>
      )}

      {/* Row 2: DesirabilityBadge (left) + vote buttons (center) + coverage (right) */}
      {showRow2 && showNames && !isMarker && (
        <div className="flex items-center gap-2 min-w-0">
          {showStars && desirabilityScore != null && (
            <DesirabilityBadge score={desirabilityScore} className="flex-shrink-0" />
          )}
          {readOnly && onVoteWant && onVoteDontWant && (
            <div className="flex items-center gap-[8px] flex-shrink-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onVoteWant(shiftId); }}
                className="p-[8px] rounded bg-[var(--color-primary-100)] hover:bg-[var(--color-success-100)] hover:text-[var(--color-success-600)] transition-colors"
                title="Want this shift"
              >
                <ThumbsUp style={{ width: 60, height: 60 }} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onVoteDontWant(shiftId); }}
                className="p-[8px] rounded bg-[var(--color-primary-100)] hover:bg-red-100 hover:text-[var(--color-unfilled)] transition-colors"
                title="Don't want this shift"
              >
                <ThumbsDown style={{ width: 60, height: 60 }} />
              </button>
            </div>
          )}
          <span className={cn(
            "text-[100px] leading-[1.15] font-medium ml-auto flex-shrink-0",
            assignmentCount < capacity ? "text-[var(--color-unfilled)]" : "text-[var(--color-covered)]"
          )}>
            {assignmentCount}/{capacity}
          </span>
        </div>
      )}

      {/* Row 3: Avatar emoji + name pairs */}
      {showRow3 && showNames && !isMarker && assignedMembers && assignedMembers.length > 0 && (
        <div className="flex items-center gap-[20px] min-w-0 overflow-hidden">
          {assignedMembers.slice(0, 4).map((m, i) => (
            <div key={i} className="flex items-center gap-[8px] flex-shrink-0">
              <div
                className="w-[100px] h-[100px] rounded-full bg-gradient-to-br from-[var(--color-primary-400)] to-[var(--color-primary-600)] flex items-center justify-center text-white text-[60px] leading-none border-[3px] border-white flex-shrink-0"
                title={m.alias}
              >
                {m.avatarId || m.alias.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-[100px] leading-[1.15] text-gray-700 whitespace-nowrap">
                {m.alias}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShiftBlockNodeComponent({ data, selected }: NodeProps) {
  const {
    shiftId,
    templateName,
    color,
    startTime,
    endTime,
    capacity,
    assignmentCount,
    desirabilityScore,
    assignedMembers,
    isAssignedToCurrentUser,
    onResizeEnd,
    readOnly,
    onVoteWant,
    onVoteDontWant,
  } = data as ShiftBlockData;

  return (
    <>
      {!readOnly && (
        <NodeResizer
          isVisible={selected}
          minWidth={SNAP_PIXELS}
          handleStyle={{ width: 8, height: 24, borderRadius: 2 }}
          lineStyle={{ borderWidth: 0 }}
          keepAspectRatio={false}
          onResizeEnd={(_e, p) => {
            try {
              const result = onResizeEnd?.(
                `shift-${shiftId}`,
                { width: p.width, x: p.x },
              );
              if (result instanceof Promise) {
                result.catch((err: unknown) => {
                  if (err) console.error("Resize failed:", err);
                });
              }
            } catch (err) {
              if (err) console.error("Resize failed:", err);
            }
          }}
        />
      )}

      <div
        className={cn(
          "w-full h-full rounded-lg border-l-4 overflow-hidden cursor-grab group",
          "bg-white/80 backdrop-blur-sm",
          "shadow-[var(--shift-shadow)] hover:shadow-[var(--shift-shadow-hover)]",
          "transition-shadow",
          selected && "ring-2 ring-[var(--color-primary-500)]",
          isAssignedToCurrentUser && "ring-2 ring-[var(--color-success-500)]",
          capacity === 0 && "opacity-60 border-dashed",
        )}
        style={{ borderLeftColor: color }}
      >
        <ShiftContent
          shiftId={shiftId}
          templateName={templateName}
          startTime={startTime}
          endTime={endTime}
          assignmentCount={assignmentCount}
          capacity={capacity}
          desirabilityScore={desirabilityScore}
          assignedMembers={assignedMembers}
          readOnly={readOnly}
          onVoteWant={onVoteWant}
          onVoteDontWant={onVoteDontWant}
        />
      </div>
    </>
  );
}

export const ShiftBlockNode = memo(ShiftBlockNodeComponent);
