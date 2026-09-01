"use client";

import { memo, useState } from "react";
import { type NodeProps, NodeResizer } from "@xyflow/react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SNAP_PIXELS } from "../utils/constants";

export type MarkerNodeData = {
  markerId: string;
  text: string;
  readOnly?: boolean;
  onSave?: (text: string) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onResizeEnd?: (event: unknown, params: { width: number; x?: number }) => void | Promise<void>;
};

function MarkerNodeComponent({ data, selected }: NodeProps) {
  const { text, readOnly, onSave, onDelete, onResizeEnd } = data as MarkerNodeData;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  function commit() {
    setEditing(false);
    if (draft !== text) onSave?.(draft);
  }

  return (
    <>
      {!readOnly && (
        <NodeResizer
          isVisible={selected}
          minWidth={SNAP_PIXELS}
          handleStyle={{ width: 8, height: 24, borderRadius: 2 }}
          lineStyle={{ borderWidth: 0 }}
          keepAspectRatio={false}
          onResizeEnd={onResizeEnd}
        />
      )}
      <div
        className={cn(
          "w-full h-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col px-[16px] py-[8px] gap-[8px] overflow-hidden",
          selected && "ring-2 ring-blue-400",
        )}
        onClick={() => {
          if (!readOnly) setEditing(true);
        }}
      >
      {editing && !readOnly ? (
        <textarea
          autoFocus
          className="flex-1 w-full min-w-0 resize-none bg-transparent text-[100px] leading-[1.15] text-gray-700 outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        />
      ) : (
        <span className="min-w-0 text-[100px] leading-[1.15] text-gray-600 whitespace-pre-wrap break-words">
          {text || "Click to add a note"}
        </span>
      )}
      {!readOnly && onDelete && (
        <button
          type="button"
          className="self-end text-gray-400 hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("Delete this note?")) onDelete();
          }}
          aria-label="Delete marker"
        >
          <Trash2 size={60} />
        </button>
      )}
      </div>
    </>
  );
}

export const MarkerNode = memo(MarkerNodeComponent);
