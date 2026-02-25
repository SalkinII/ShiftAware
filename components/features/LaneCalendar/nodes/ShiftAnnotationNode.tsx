"use client";

import React, { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { DesirabilityBadge } from "@/components/ui/DesirabilityBadge";

export type ShiftAnnotationData = {
  timeLabel: string;
  shiftName: string;
  assignmentCount: number;
  capacity: number;
  assignedMembers?: Array<{ alias: string; avatarId?: string }>;
  desirabilityScore?: number;
  color: string;
  parentShiftId: string;
};

function ShiftAnnotationNodeComponent({ data }: NodeProps) {
  const {
    timeLabel,
    shiftName,
    assignmentCount,
    capacity,
    assignedMembers,
    desirabilityScore,
    color
  } = data as ShiftAnnotationData;

  const isFull = assignmentCount >= capacity;
  const needed = capacity - assignmentCount;

  return (
    <div
      className={cn(
        "pointer-events-none select-none",
        "flex flex-col gap-1"
      )}
      style={{
        // Fixed visual size regardless of zoom
        width: '200px',
      }}
    >
      {/* Time Label - Large and bold */}
      <div className="text-base font-bold text-gray-900 leading-tight">
        {timeLabel}
      </div>

      {/* Shift Name */}
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm font-semibold text-gray-900 truncate">
          {shiftName}
        </span>
        {desirabilityScore != null && (
          <DesirabilityBadge score={desirabilityScore} />
        )}
      </div>

      {/* Assignment Status */}
      <div className="flex items-center gap-2 mt-1">
        {/* Avatar circles with initials */}
        {assignedMembers && assignedMembers.slice(0, 3).map((member, idx) => (
          <div
            key={idx}
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center",
              "text-xs font-bold text-white flex-shrink-0"
            )}
            style={{
              backgroundColor: color,
              marginLeft: idx > 0 ? '-4px' : '0',
              zIndex: 10 - idx
            }}
            title={member.alias}
          >
            {member.alias.slice(0, 2).toUpperCase()}
          </div>
        ))}

        {/* Names list */}
        {assignedMembers && assignedMembers.length > 0 && (
          <span className="text-xs text-gray-600 truncate max-w-[120px]">
            {assignedMembers.slice(0, 2).map(m => m.alias).join(', ')}
            {assignedMembers.length > 2 ? ` +${assignedMembers.length - 2}` : ''}
          </span>
        )}
      </div>

      {/* Status indicator */}
      <div className="text-xs font-medium mt-0.5">
        <span className={cn(
          isFull ? "text-green-600" : "text-amber-600"
        )}>
          {isFull
            ? `${assignmentCount}/${capacity} assigned`
            : `${assignmentCount}/${capacity} - needs ${needed} more`
          }
        </span>
      </div>
    </div>
  );
}

export const ShiftAnnotationNode = memo(ShiftAnnotationNodeComponent);
