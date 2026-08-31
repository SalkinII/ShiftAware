"use client";

import { memo, useState } from "react";
import { type NodeProps } from "@xyflow/react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type MarkerNodeData = {
  markerId: string;
  text: string;
  readOnly?: boolean;
  onSave?: (text: string) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
};

function MarkerNodeComponent({ data, selected }: NodeProps) {
  const { text, readOnly, onSave, onDelete } = data as MarkerNodeData;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  function commit() {
    setEditing(false);
    if (draft !== text) onSave?.(draft);
  }

  return (
    <div
      className={cn(
        "w-full h-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-2 flex flex-col",
        selected && "ring-2 ring-blue-400",
      )}
      onClick={() => {
        if (!readOnly) setEditing(true);
      }}
    >
      {editing && !readOnly ? (
        <textarea
          autoFocus
          className="flex-1 w-full resize-none bg-transparent text-xs text-gray-700 outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        />
      ) : (
        <span className="text-xs text-gray-600 whitespace-pre-wrap break-words">
          {text || "Click to add a note"}
        </span>
      )}
      {!readOnly && onDelete && (
        <button
          type="button"
          className="self-end mt-1 text-gray-400 hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("Delete this note?")) onDelete();
          }}
          aria-label="Delete marker"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

export const MarkerNode = memo(MarkerNodeComponent);
