"use client";

import { memo } from "react";
import { type NodeProps, useViewport, NodeResizer } from "@xyflow/react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
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

/** Item definition for dynamic reveal */
interface RevealItem {
  key: string;
  minWidth: number;
  minHeight: number;
  render: () => React.ReactNode;
}

function DynamicShiftContent({
  shiftId,
  templateName,
  startTime,
  endTime,
  assignmentCount,
  capacity,
  desirabilityScore,
  assignedMembers,
  zoom,
  width,
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
  zoom: number;
  width: number;
  readOnly?: boolean;
  onVoteWant?: (shiftId: string) => void;
  onVoteDontWant?: (shiftId: string) => void;
}) {
  const isMarker = capacity === 0;
  const isFull = assignmentCount >= capacity;
  const needed = capacity - assignmentCount;

  const contentWidth = width;
  const contentHeight = SHIFT_NODE_HEIGHT;
  const items: RevealItem[] = [];
  let usedHeight = 8;

  if (!isMarker) {
    const memberItem: RevealItem = {
      key: "members",
      minWidth: 60,
      minHeight: 24,
      render: () => (
        <div className="text-lg font-medium text-gray-900 truncate" key="members">
          {assignedMembers && assignedMembers.length > 0
            ? assignedMembers.map((m) => m.alias).join(", ")
            : "—"}
        </div>
      ),
    };
    if (
      contentWidth >= memberItem.minWidth &&
      usedHeight + memberItem.minHeight <= contentHeight
    ) {
      items.push(memberItem);
      usedHeight += memberItem.minHeight;
    }
  } else {
    items.push({
      key: "marker",
      minWidth: 50,
      minHeight: 20,
      render: () => (
        <span
          key="marker"
          className="text-sm font-medium text-gray-400 bg-gray-100 rounded px-2 py-0.5"
        >
          Marker
        </span>
      ),
    });
    usedHeight += 20;
  }

  const timeItem: RevealItem = {
    key: "time",
    minWidth: 100,
    minHeight: 20,
    render: () => (
      <div className="text-base font-semibold text-gray-600" key="time">
        {format(new Date(startTime), "HH:mm")}–
        {format(new Date(endTime), "HH:mm")}
      </div>
    ),
  };
  if (
    contentWidth >= timeItem.minWidth &&
    usedHeight + timeItem.minHeight <= contentHeight
  ) {
    items.push(timeItem);
    usedHeight += timeItem.minHeight;
  }

  const nameItem: RevealItem = {
    key: "name",
    minWidth: 80,
    minHeight: 22,
    render: () => (
      <div className="text-lg font-bold text-gray-900 truncate" key="name">
        {templateName}
      </div>
    ),
  };
  if (
    contentWidth >= nameItem.minWidth &&
    usedHeight + nameItem.minHeight <= contentHeight
  ) {
    items.push(nameItem);
    usedHeight += nameItem.minHeight;
  }

  if (desirabilityScore != null) {
    const desItem: RevealItem = {
      key: "desirability",
      minWidth: 60,
      minHeight: 18,
      render: () => (
        <span
          className="text-base font-bold text-amber-500"
          key="desirability"
        >
          {"★".repeat(desirabilityScore)}
        </span>
      ),
    };
    if (
      contentWidth >= desItem.minWidth &&
      usedHeight + desItem.minHeight <= contentHeight
    ) {
      items.push(desItem);
      usedHeight += desItem.minHeight;
    }
  }

  if (!isMarker) {
    const countItem: RevealItem = {
      key: "count",
      minWidth: 40,
      minHeight: 18,
      render: () => (
        <div className="text-base font-bold text-gray-500" key="count">
          {assignmentCount}/{capacity}
        </div>
      ),
    };
    if (
      contentWidth >= countItem.minWidth &&
      usedHeight + countItem.minHeight <= contentHeight
    ) {
      items.push(countItem);
      usedHeight += countItem.minHeight;
    }
  }

  if (!isMarker) {
    const statusItem: RevealItem = {
      key: "status",
      minWidth: 100,
      minHeight: 18,
      render: () => (
        <span
          className={`text-sm font-medium ${
            isFull ? "text-green-600" : "text-amber-600"
          }`}
          key="status"
        >
          {isFull ? "fully staffed" : `needs ${needed} more`}
        </span>
      ),
    };
    if (
      contentWidth >= statusItem.minWidth &&
      usedHeight + statusItem.minHeight <= contentHeight
    ) {
      items.push(statusItem);
      usedHeight += statusItem.minHeight;
    }
  }

  if (
    !isMarker &&
    assignedMembers &&
    assignedMembers.length > 0
  ) {
    const avatarItem: RevealItem = {
      key: "avatars",
      minWidth: 80,
      minHeight: 32,
      render: () => (
        <div className="flex -space-x-2" key="avatars">
          {assignedMembers.slice(0, 4).map((m, i) => (
            <div
              key={i}
              className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold border-2 border-white"
              title={m.alias}
            >
              {m.alias.slice(0, 2).toUpperCase()}
            </div>
          ))}
        </div>
      ),
    };
    if (
      contentWidth >= avatarItem.minWidth &&
      usedHeight + avatarItem.minHeight <= contentHeight
    ) {
      items.push(avatarItem);
      usedHeight += avatarItem.minHeight;
    }
  }

  if (readOnly && onVoteWant && onVoteDontWant && !isMarker) {
    const voteItem: RevealItem = {
      key: "votes",
      minWidth: 80,
      minHeight: 36,
      render: () => (
        <div className="flex items-center gap-2" key="votes">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onVoteWant(shiftId);
            }}
            className="p-2 rounded-lg bg-gray-100 hover:bg-green-100 hover:text-green-600 transition-colors"
            title="Want this shift"
          >
            <ThumbsUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onVoteDontWant(shiftId);
            }}
            className="p-2 rounded-lg bg-gray-100 hover:bg-red-100 hover:text-red-600 transition-colors"
            title="Don't want this shift"
          >
            <ThumbsDown className="w-4 h-4" />
          </button>
        </div>
      ),
    };
    if (
      contentWidth >= voteItem.minWidth &&
      usedHeight + voteItem.minHeight <= contentHeight
    ) {
      items.push(voteItem);
      usedHeight += voteItem.minHeight;
    }
  }

  return (
    <div
      className="h-full flex flex-col px-3 py-1 gap-0.5 overflow-hidden"
      style={{
        transform: `scale(${1 / zoom})`,
        transformOrigin: "top left",
        width: width * zoom,
        height: SHIFT_NODE_HEIGHT * zoom,
      }}
    >
      {items.length > 0 ? (
        items.map((item) => item.render())
      ) : (
        <div className="text-base font-medium text-gray-400">—</div>
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
        <DynamicShiftContent
          shiftId={shiftId}
          templateName={templateName}
          startTime={startTime}
          endTime={endTime}
          assignmentCount={assignmentCount}
          capacity={capacity}
          desirabilityScore={desirabilityScore}
          assignedMembers={assignedMembers}
          zoom={zoom}
          width={width}
          readOnly={readOnly}
          onVoteWant={onVoteWant}
          onVoteDontWant={onVoteDontWant}
        />
      </div>
    </>
  );
}

export const ShiftBlockNode = memo(ShiftBlockNodeComponent);
