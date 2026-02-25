"use client";

import React, { memo } from "react";
import { type NodeProps, NodeResizer } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { SNAP_PIXELS } from "../utils/constants";

export type ShiftBlockData = {
  shiftId: string;
  color: string;
  width: number;
  onResizeEnd?: (e: unknown, p: { width: number }) => void | Promise<void>;
  readOnly?: boolean;
};

function ShiftBlockNodeComponent({ data, selected }: NodeProps) {
  const { color, width, onResizeEnd, readOnly } = data as ShiftBlockData;

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

      {/* Minimal visual indicator - just the colored bar */}
      <div
        style={{
          width: `${width}px`,
          height: "4px",
          backgroundColor: color
        }}
        className={cn(
          "rounded-full cursor-grab",
          selected && "ring-2 ring-blue-500 ring-offset-1"
        )}
      />
    </>
  );
}

export const ShiftBlockNode = memo(ShiftBlockNodeComponent);
