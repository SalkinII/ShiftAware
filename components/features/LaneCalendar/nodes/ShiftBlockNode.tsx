"use client";

import { memo } from "react";
import { type NodeProps, useViewport, NodeResizer } from "@xyflow/react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  ZOOM_COMPACT,
  ZOOM_MINIMAL,
  SHIFT_NODE_HEIGHT,
  SNAP_PIXELS,
} from "../utils/constants";

export type ShiftBlockData = {
  shiftId: string;
  templateName: string;
  type: string;
  color: string;
  startTime: string;
  endTime: string;
  capacity: number;
  assignmentCount: number;
  width: number;
  desirabilityScore?: number;
  assignedMembers?: Array<{ alias: string; avatarId?: string }>;
  currentMemberId?: string;
  isAssignedToCurrentUser?: boolean;
  onResizeEnd?: (nodeId: string, p: { width: number }) => void | Promise<void>;
  readOnly?: boolean;
  onVoteWant?: (shiftId: string) => void;
  onVoteDontWant?: (shiftId: string) => void;
};

/** Minimum zoom density: just who is staffed on this shift */
function OccupationContent({
  assignedMembers,
  zoom,
  width,
}: {
  assignedMembers?: Array<{ alias: string; avatarId?: string }>;
  zoom: number;
  width: number;
}) {
  return (
    <div
      className="h-full flex flex-col items-center justify-center px-3 py-2 gap-1"
      style={{
        transform: `scale(${1 / zoom})`,
        transformOrigin: "top left",
        width: width * zoom,
        height: SHIFT_NODE_HEIGHT * zoom,
      }}
    >
      {assignedMembers && assignedMembers.length > 0 ? (
        <>
          <div className="flex -space-x-1 mb-1">
            {assignedMembers.slice(0, 4).map((m, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white border border-white"
                title={m.alias}
              >
                <span className="text-[8px] font-bold">
                  {m.alias.slice(0, 2).toUpperCase()}
                </span>
              </div>
            ))}
          </div>
          <div className="text-xl font-bold text-gray-900 text-center leading-tight truncate w-full">
            {assignedMembers
              .slice(0, 2)
              .map((m) => m.alias)
              .join(", ")}
            {assignedMembers.length > 2 && (
              <span className="text-gray-500">
                {" "}
                +{assignedMembers.length - 2}
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="text-xl font-medium text-gray-400">—</div>
      )}
    </div>
  );
}

/** Core density: time, name, desirability, count */
function CoreContent({
  templateName,
  startTime,
  endTime,
  assignmentCount,
  capacity,
  desirabilityScore,
  zoom,
  width,
}: {
  templateName: string;
  startTime: string;
  endTime: string;
  assignmentCount: number;
  capacity: number;
  desirabilityScore?: number;
  zoom: number;
  width: number;
}) {
  return (
    <div
      className="h-full flex flex-col justify-center px-4 py-2 gap-1"
      style={{
        transform: `scale(${1 / zoom})`,
        transformOrigin: "top left",
        width: width * zoom,
        height: SHIFT_NODE_HEIGHT * zoom,
      }}
    >
      <div className="text-2xl font-semibold text-gray-600">
        {format(new Date(startTime), "HH:mm")}–
        {format(new Date(endTime), "HH:mm")}
        {desirabilityScore != null && (
          <span className="ml-2 text-2xl font-bold text-amber-500">
            {"★".repeat(desirabilityScore)}
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-gray-900 truncate">
        {templateName}
      </div>
      <div className="text-2xl font-bold text-gray-500">
        {assignmentCount}/{capacity}
      </div>
    </div>
  );
}

/** Detailed density: + avatars, member names, status, vote buttons */
function DetailedContent({
  shiftId,
  templateName,
  startTime,
  endTime,
  assignmentCount,
  capacity,
  desirabilityScore,
  assignedMembers,
  isFull,
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
  isFull: boolean;
  readOnly?: boolean;
  onVoteWant?: (shiftId: string) => void;
  onVoteDontWant?: (shiftId: string) => void;
}) {
  const needed = capacity - assignmentCount;

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header: time + score */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="text-3xl font-bold text-gray-900 truncate">
            {templateName}
          </div>
          <div className="text-2xl font-semibold text-gray-500">
            {format(new Date(startTime), "HH:mm")} –{" "}
            {format(new Date(endTime), "HH:mm")}
          </div>
        </div>
        {desirabilityScore != null && (
          <span className="text-2xl font-bold text-amber-500 flex-shrink-0 ml-2">
            {"★".repeat(desirabilityScore)}
          </span>
        )}
      </div>

      {/* Assignments with names */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {assignedMembers && assignedMembers.length > 0 ? (
          <>
            <div className="flex -space-x-2">
              {assignedMembers.slice(0, 4).map((m, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold border-2 border-white"
                  title={m.alias}
                >
                  {m.alias.slice(0, 2).toUpperCase()}
                </div>
              ))}
            </div>
            <span className="text-2xl font-medium text-gray-600">
              {assignedMembers.slice(0, 3).map((m) => m.alias).join(", ")}
              {assignedMembers.length > 3 && ` +${assignedMembers.length - 3}`}
            </span>
          </>
        ) : (
          <span className="text-2xl text-gray-400">No assignments</span>
        )}
      </div>

      {/* Footer: status + vote */}
      <div className="mt-auto pt-3 border-t border-gray-200/50 flex items-center justify-between">
        <span
          className={cn(
            "text-2xl font-medium",
            isFull ? "text-green-600" : "text-amber-600",
          )}
        >
          {isFull
            ? `${assignmentCount}/${capacity} — fully staffed`
            : `${assignmentCount}/${capacity} — needs ${needed} more`}
        </span>

        <div className="flex items-center gap-2">
          {readOnly && onVoteWant && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVoteWant(shiftId);
              }}
              className="p-2 rounded-lg bg-gray-100 hover:bg-green-100 hover:text-green-600 transition-colors"
              title="Want this shift"
            >
              <ThumbsUp className="w-5 h-5" />
            </button>
          )}
          {readOnly && onVoteDontWant && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVoteDontWant(shiftId);
              }}
              className="p-2 rounded-lg bg-gray-100 hover:bg-red-100 hover:text-red-600 transition-colors"
              title="Don't want this shift"
            >
              <ThumbsDown className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
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
    width,
    desirabilityScore,
    assignedMembers,
    isAssignedToCurrentUser,
    onResizeEnd,
    readOnly,
    onVoteWant,
    onVoteDontWant,
  } = data as ShiftBlockData;

  const { zoom } = useViewport();
  const isDetailed = zoom >= ZOOM_COMPACT;
  const isCore = zoom >= ZOOM_MINIMAL;
  const isFull = assignmentCount >= capacity;

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
                { width: p.width ?? (p as any).x ?? width },
              );
              if (result instanceof Promise) {
                result.catch((err) => console.error("Resize failed:", err));
              }
            } catch (err) {
              console.error("Resize failed:", err);
            }
          }}
        />
      )}

      <div
        style={{
          width: `${width}px`,
          height: `${SHIFT_NODE_HEIGHT}px`,
          borderLeftColor: color,
        }}
        className={cn(
          "rounded-lg border-l-4 overflow-hidden cursor-grab group",
          "bg-white/80 backdrop-blur-sm",
          "shadow-[var(--shift-shadow)] hover:shadow-[var(--shift-shadow-hover)]",
          "transition-shadow",
          selected && "ring-2 ring-blue-500",
          isAssignedToCurrentUser && "ring-2 ring-green-500",
        )}
      >
        {isDetailed ? (
          <DetailedContent
            shiftId={shiftId}
            templateName={templateName}
            startTime={startTime}
            endTime={endTime}
            assignmentCount={assignmentCount}
            capacity={capacity}
            desirabilityScore={desirabilityScore}
            assignedMembers={assignedMembers}
            isFull={isFull}
            readOnly={readOnly}
            onVoteWant={onVoteWant}
            onVoteDontWant={onVoteDontWant}
          />
        ) : isCore ? (
          <CoreContent
            templateName={templateName}
            startTime={startTime}
            endTime={endTime}
            assignmentCount={assignmentCount}
            capacity={capacity}
            desirabilityScore={desirabilityScore}
            zoom={zoom}
            width={width}
          />
        ) : (
          <OccupationContent
            assignedMembers={assignedMembers}
            zoom={zoom}
            width={width}
          />
        )}
      </div>
    </>
  );
}

export const ShiftBlockNode = memo(ShiftBlockNodeComponent);
