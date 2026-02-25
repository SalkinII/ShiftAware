"use client";

import { memo } from "react";
import { type NodeProps, useViewport, NodeResizer } from "@xyflow/react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DesirabilityBadge } from "@/components/ui/DesirabilityBadge";
import { AvatarStack } from "@/components/ui/AvatarStack";
import {
  ZOOM_MINIMAL,
  ZOOM_COMPACT,
  SHIFT_NODE_HEIGHT,
  SNAP_PIXELS,
} from "../utils/constants";

export type ShiftBlockData = {
  shiftId: string;
  templateName: string;
  type: string;
  color: string;
  startTime: string; // ISO
  endTime: string; // ISO
  capacity: number;
  assignmentCount: number;
  width: number; // calculated width in px
  desirabilityScore?: number; // 1-5
  assignedMembers?: Array<{ alias: string; avatarId?: string }>;
  currentMemberId?: string;
  isAssignedToCurrentUser?: boolean;
  onResizeEnd?: (e: unknown, p: { width: number }) => void | Promise<void>;
  readOnly?: boolean;
  onVoteWant?: (shiftId: string) => void;
  onVoteDontWant?: (shiftId: string) => void;
};

type ZoomDensity = "minimal" | "compact" | "standard" | "detailed";

function getZoomDensity(zoom: number): ZoomDensity {
  if (zoom < ZOOM_MINIMAL) return "minimal";
  if (zoom < ZOOM_COMPACT) return "compact";
  if (zoom < 1.5) return "standard";
  return "detailed";
}

function MinimalContent({
  templateName,
  zoom,
  width,
}: {
  templateName: string;
  zoom: number;
  width: number;
}) {
  return (
    <div
      className="h-full flex items-center px-2"
      style={{
        transform: `scale(${1 / zoom})`,
        transformOrigin: "left center",
        width: width * zoom,
      }}
    >
      <span className="text-sm font-medium text-gray-900 truncate">
        {templateName}
      </span>
    </div>
  );
}

function CompactContent({
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
      className="h-full flex flex-col justify-center px-2 py-1"
      style={{
        transform: `scale(${1 / zoom})`,
        transformOrigin: "left center",
        width: width * zoom,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-gray-900 truncate">
          {templateName}
        </span>
        {desirabilityScore != null && (
          <DesirabilityBadge score={desirabilityScore} />
        )}
      </div>
      <div className="text-xs text-gray-500">
        {format(new Date(startTime), "HH:mm")}–{format(new Date(endTime), "HH:mm")}
      </div>
      <div className="text-xs text-gray-500">
        {assignmentCount}/{capacity}
      </div>
    </div>
  );
}

function StandardContent({
  templateName,
  startTime,
  endTime,
  assignmentCount,
  capacity,
  desirabilityScore,
  assignedMembers,
  isFull,
}: {
  templateName: string;
  startTime: string;
  endTime: string;
  assignmentCount: number;
  capacity: number;
  desirabilityScore?: number;
  assignedMembers?: Array<{ alias: string; avatarId?: string }>;
  isFull: boolean;
}) {
  const needed = capacity - assignmentCount;

  return (
    <div className="h-full flex flex-col p-3">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {templateName}
          </div>
          <div className="text-xs text-gray-500">
            {format(new Date(startTime), "HH:mm")} – {format(new Date(endTime), "HH:mm")}
          </div>
        </div>
        {desirabilityScore != null && (
          <DesirabilityBadge score={desirabilityScore} className="flex-shrink-0" />
        )}
      </div>

      {/* Assignments */}
      <div className="flex items-center gap-2 mb-2">
        {assignedMembers && assignedMembers.length > 0 && (
          <AvatarStack members={assignedMembers} max={3} />
        )}
        <span className="text-xs text-gray-500">
          {assignmentCount}/{capacity} assigned
        </span>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-2 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {isFull ? "Fully staffed" : `Needs ${needed} more`}
        </span>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Edit hint - actual button in detailed view */}
        </div>
      </div>
    </div>
  );
}

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
    <div className="h-full flex flex-col p-3">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {templateName}
          </div>
          <div className="text-xs text-gray-500">
            {format(new Date(startTime), "HH:mm")} – {format(new Date(endTime), "HH:mm")}
          </div>
        </div>
        {desirabilityScore != null && (
          <DesirabilityBadge score={desirabilityScore} className="flex-shrink-0" />
        )}
      </div>

      {/* Assignments with names */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {assignedMembers && assignedMembers.length > 0 && (
          <>
            <AvatarStack members={assignedMembers} max={4} />
            <span className="text-xs text-gray-500">
              {assignedMembers.slice(0, 3).map((m) => m.alias).join(", ")}
              {assignedMembers.length > 3 && ` +${assignedMembers.length - 3}`}
            </span>
          </>
        )}
        {(!assignedMembers || assignedMembers.length === 0) && (
          <span className="text-xs text-gray-400">No assignments</span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto pt-2 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {isFull ? "Fully staffed" : `Needs ${needed} more`}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {readOnly && onVoteWant && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVoteWant(shiftId);
              }}
              className="p-1 rounded bg-gray-100 hover:bg-green-100 hover:text-green-600 transition-colors"
              title="Want this shift"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
          )}
          {readOnly && onVoteDontWant && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVoteDontWant(shiftId);
              }}
              className="p-1 rounded bg-gray-100 hover:bg-red-100 hover:text-red-600 transition-colors"
              title="Don't want this shift"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
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
  const density = getZoomDensity(zoom);
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
          onResizeEnd={(e, p) => {
            try {
              const result = onResizeEnd?.(e, p);
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
          "bg-white rounded-lg border-l-4 overflow-hidden cursor-grab group",
          "shadow-[var(--shift-shadow)] hover:shadow-[var(--shift-shadow-hover)]",
          "transition-shadow",
          selected && "ring-2 ring-blue-500",
          isAssignedToCurrentUser && "ring-2 ring-green-500"
        )}
      >
        {density === "minimal" && (
          <MinimalContent
            templateName={templateName}
            zoom={zoom}
            width={width}
          />
        )}
        {density === "compact" && (
          <CompactContent
            templateName={templateName}
            startTime={startTime}
            endTime={endTime}
            assignmentCount={assignmentCount}
            capacity={capacity}
            desirabilityScore={desirabilityScore}
            zoom={zoom}
            width={width}
          />
        )}
        {density === "standard" && (
          <StandardContent
            templateName={templateName}
            startTime={startTime}
            endTime={endTime}
            assignmentCount={assignmentCount}
            capacity={capacity}
            desirabilityScore={desirabilityScore}
            assignedMembers={assignedMembers}
            isFull={isFull}
          />
        )}
        {density === "detailed" && (
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
        )}
      </div>
    </>
  );
}

export const ShiftBlockNode = memo(ShiftBlockNodeComponent);
