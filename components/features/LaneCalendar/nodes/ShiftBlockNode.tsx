"use client";

import { memo, useRef, useState, useEffect } from "react";
import { type NodeProps, NodeResizer } from "@xyflow/react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SNAP_PIXELS } from "../utils/constants";

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
const W_TIME = 140;   // add time range
const W_STARS = 180;  // add desirability stars
const H_ROW2 = 24;    // show second row (shift name, count)
const H_ROW3 = 48;    // show third row (avatars, votes)

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
  const isFull = assignmentCount >= capacity;
  const needed = capacity - assignmentCount;

  const showNames = mW >= W_NAMES;
  const showTime = mW >= W_TIME;
  const showStars = mW >= W_STARS && desirabilityScore != null;
  const showRow2 = mH >= H_ROW2;
  const showRow3 = mH >= H_ROW3;

  const nameText = isMarker
    ? "Marker"
    : assignedMembers && assignedMembers.length > 0
      ? assignedMembers.map((m) => m.alias).join(", ")
      : "—";

  return (
    <div
      ref={containerRef}
      className="h-full w-full flex flex-col px-2 py-1 overflow-hidden"
    >
      {/* Row 1: Names (left) + Time + Stars (right) */}
      {showNames && (
        <div className="flex items-baseline gap-1 min-w-0">
          <span className={cn(
            "truncate font-semibold text-gray-900 flex-1 min-w-0",
            isMarker ? "text-gray-400 text-xs" : "text-xs"
          )}>
            {nameText}
          </span>
          {showTime && (
            <span className="text-[10px] text-gray-500 whitespace-nowrap flex-shrink-0">
              {format(new Date(startTime), "HH:mm")}–{format(new Date(endTime), "HH:mm")}
            </span>
          )}
          {showStars && (
            <span className="text-[10px] text-amber-500 flex-shrink-0">
              {"★".repeat(desirabilityScore!)}
            </span>
          )}
        </div>
      )}

      {/* Row 2: Shift name + Count */}
      {showRow2 && showNames && !isMarker && (
        <div className="flex items-baseline gap-1 min-w-0">
          <span className="truncate text-[10px] text-gray-600 flex-1 min-w-0">
            {templateName}
          </span>
          <span className="text-[10px] font-medium text-gray-500 flex-shrink-0">
            {assignmentCount}/{capacity}
          </span>
          <span className={cn(
            "text-[10px] flex-shrink-0",
            isFull ? "text-green-600" : "text-amber-600"
          )}>
            {isFull ? "✓" : `−${needed}`}
          </span>
        </div>
      )}

      {/* Row 3: Avatars + Vote buttons */}
      {showRow3 && showNames && !isMarker && (
        <div className="flex items-center gap-1 min-w-0">
          {assignedMembers && assignedMembers.length > 0 && (
            <div className="flex -space-x-1 flex-1 min-w-0">
              {assignedMembers.slice(0, 4).map((m, i) => (
                <div
                  key={i}
                  className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[7px] font-bold border border-white flex-shrink-0"
                  title={m.alias}
                >
                  {m.alias.slice(0, 2).toUpperCase()}
                </div>
              ))}
            </div>
          )}
          {readOnly && onVoteWant && onVoteDontWant && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onVoteWant(shiftId); }}
                className="p-0.5 rounded bg-gray-100 hover:bg-green-100 hover:text-green-600 transition-colors"
                title="Want this shift"
              >
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onVoteDontWant(shiftId); }}
                className="p-0.5 rounded bg-gray-100 hover:bg-red-100 hover:text-red-600 transition-colors"
                title="Don't want this shift"
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
            </div>
          )}
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
                result.catch((err: unknown) => console.error("Resize failed:", err));
              }
            } catch (err) {
              console.error("Resize failed:", err);
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
          selected && "ring-2 ring-blue-500",
          isAssignedToCurrentUser && "ring-2 ring-green-500",
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
