"use client";

import { useCallback, useMemo, useState, useRef } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  type Node,
  type NodeChange,
  applyNodeChanges,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { type LaneConfig } from "@/lib/types/lane";
import { LaneZoneNode } from "./nodes/LaneZoneNode";
import { DaySeparatorNode } from "./nodes/DaySeparatorNode";
import { ShiftBlockNode } from "./nodes/ShiftBlockNode";
import { TimeRulerPanel } from "./panels/TimeRulerPanel";
import { LaneLabelsColumn } from "./panels/LaneLabelsColumn";
import { useLaneNodes } from "./hooks/useLaneNodes";
import { useShiftNodes, type ShiftLike } from "./hooks/useShiftNodes";
import { useCanvasActions } from "./hooks/useCanvasActions";
import {
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  PIXELS_PER_HOUR,
  LANE_HEIGHT,
  SNAP_PIXELS,
} from "./utils/constants";
import { widthToDuration, snapX } from "./utils/coordinates";

const nodeTypes = {
  laneZone: LaneZoneNode,
  daySeparator: DaySeparatorNode,
  shiftBlock: ShiftBlockNode,
};

interface LaneCalendarCanvasProps {
  shifts: ShiftLike[] | null;
  lanes: LaneConfig[];
  eventStart: Date | null;
  eventEnd: Date | null;
  eventId: string | null;
  onShiftSelected?: (shiftId: string | null) => void;
  onShiftCreated?: () => void;
  onShiftUpdated?: () => void;
}

function LaneCalendarCanvasInner({
  shifts,
  lanes,
  eventStart,
  eventEnd,
  eventId,
  onShiftSelected,
  onShiftCreated,
  onShiftUpdated,
}: LaneCalendarCanvasProps) {
  const laneNodes = useLaneNodes(lanes, eventStart, eventEnd);
  const shiftNodes = useShiftNodes(shifts, lanes, eventStart);

  const [nodes, setNodes] = useState<Node[]>([]);

  // Merge lane + shift nodes when they change
  useMemo(() => {
    setNodes([...laneNodes, ...shiftNodes]);
  }, [laneNodes, shiftNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));

      // Detect resize-end: when a shift node's dimensions change
      for (const change of changes) {
        if (change.type === "dimensions" && (change as any).id?.startsWith("shift-")) {
          // Will be handled by onNodeDragStop or a separate resize callback
        }
      }
    },
    [],
  );

  const { handleDrop, handleDragOver, handleNodeDragStop } = useCanvasActions({
    lanes,
    eventStart,
    eventId,
    onShiftCreated,
    onShiftUpdated,
  });

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.id.startsWith("shift-")) {
        onShiftSelected?.((node.data as any).shiftId);
      }
    },
    [onShiftSelected],
  );

  const handlePaneClick = useCallback(() => {
    onShiftSelected?.(null);
  }, [onShiftSelected]);

  if (!eventStart || !eventEnd) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-400">
        Select an event to view the calendar
      </div>
    );
  }

  return (
    <div className="relative" style={{ height: "70vh", minHeight: 500 }}>
      <LaneLabelsColumn lanes={lanes} />
      <div style={{ marginLeft: 140, height: "100%" }}>
        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          defaultViewport={{ x: 0, y: 0, zoom: DEFAULT_ZOOM }}
          snapToGrid
          snapGrid={[SNAP_PIXELS, LANE_HEIGHT]}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          proOptions={{ hideAttribution: true }}
        >
          <TimeRulerPanel eventStart={eventStart} eventEnd={eventEnd} />
          <Controls position="bottom-right" />
          <MiniMap
            position="bottom-left"
            nodeColor={(node) => {
              if (node.type === "shiftBlock") return (node.data as any).color;
              return "transparent";
            }}
            maskColor="rgba(0,0,0,0.1)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

/**
 * LaneCalendarCanvas — wrapped in ReactFlowProvider.
 */
export function LaneCalendarCanvas(props: LaneCalendarCanvasProps) {
  return (
    <ReactFlowProvider>
      <LaneCalendarCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
