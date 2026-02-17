"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Panel,
  useViewport,
  type Node,
  type NodeChange,
  applyNodeChanges,
  ReactFlowProvider,
  useReactFlow,
  getNodesBounds,
  getViewportForBounds,
} from "@xyflow/react";
import { toPng } from "html-to-image";
import "@xyflow/react/dist/style.css";

import { type LaneConfig } from "@/lib/types/lane";
import { LaneZoneNode } from "./nodes/LaneZoneNode";
import { DaySeparatorNode } from "./nodes/DaySeparatorNode";
import { HourGridNode } from "./nodes/HourGridNode";
import { type ShiftBlockData, ShiftBlockNode } from "./nodes/ShiftBlockNode";
import { TimeRulerPanel } from "./panels/TimeRulerPanel";
import { useLaneNodes } from "./hooks/useLaneNodes";
import { useShiftNodes, type ShiftLike } from "./hooks/useShiftNodes";
import { useCanvasActions } from "./hooks/useCanvasActions";
import {
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  LANE_HEIGHT,
  SNAP_PIXELS,
} from "./utils/constants";
import { Shield } from "lucide-react";

const nodeTypes = {
  laneZone: LaneZoneNode,
  hourGrid: HourGridNode,
  daySeparator: DaySeparatorNode,
  shiftBlock: ShiftBlockNode,
};

/** Renders vertical alignment guide lines during shift drag */
function AlignmentGuides({
  guides,
  laneCount,
}: {
  guides: number[];
  laneCount: number;
}) {
  const { zoom, x: viewportX } = useViewport();

  return (
    <Panel position="top-left" className="pointer-events-none m-0 p-0">
      <div
        style={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        {guides.map((flowX, i) => {
          const screenX = flowX * zoom + viewportX;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: screenX,
                transform: "translateX(-50%)",
                top: 0,
                width: 1,
                height: "100%",
                borderLeft: "2px dashed #3b82f6",
                opacity: 0.7,
              }}
            />
          );
        })}
      </div>
    </Panel>
  );
}

interface LaneCalendarCanvasProps {
  shifts: ShiftLike[] | null;
  lanes: LaneConfig[];
  eventStart: Date | null;
  eventEnd: Date | null;
  eventId: string | null;
  onShiftSelected?: (shiftId: string | null) => void;
  onShiftCreated?: () => void;
  onShiftUpdated?: () => void;
  /** When true, disables drag/drop, resize; shows vote buttons on shift blocks */
  readOnly?: boolean;
  /** When true, shows a locked-state banner and disables shift mutation controls */
  shiftMutationLocked?: boolean;
  /** Message to display when shift mutation is locked */
  shiftMutationLockedMessage?: string;
  onVoteWant?: (shiftId: string) => void;
  onVoteDontWant?: (shiftId: string) => void;
  /** When set (user calendar), highlights shifts assigned to this member */
  selectedMemberId?: string | null;
}

export interface LaneCalendarCanvasHandle {
  exportToPng: () => Promise<string | null>;
}

function LaneCalendarCanvasInner(
  {
    shifts,
    lanes,
    eventStart,
    eventEnd,
    eventId,
    onShiftSelected,
    onShiftCreated,
    onShiftUpdated,
    readOnly = false,
    shiftMutationLocked = false,
    shiftMutationLockedMessage = "Shift editing is locked for the current event state",
    onVoteWant,
    onVoteDontWant,
    selectedMemberId,
  }: LaneCalendarCanvasProps,
  ref: React.Ref<LaneCalendarCanvasHandle>,
) {
  // Shift mutations are locked if explicitly set OR if readOnly
  const effectiveReadOnly = readOnly || shiftMutationLocked;

  const flowContainerRef = useRef<HTMLDivElement>(null);
  const {
    handleDrop,
    handleDragOver,
    handleNodeDragStop,
    handleResizeEnd,
    handleNodeDrag,
    clearAlignmentGuides,
    alignmentGuides,
  } = useCanvasActions({
    lanes,
    eventStart,
    eventId,
    onShiftCreated,
    onShiftUpdated,
  });

  const handleNodeDragStopWithGuides = useCallback(
    (event: React.MouseEvent, node: Node) => {
      clearAlignmentGuides();
      handleNodeDragStop(event, node);
    },
    [clearAlignmentGuides, handleNodeDragStop],
  );

  const { setViewport, fitView } = useReactFlow();
  const laneNodes = useLaneNodes(lanes, eventStart, eventEnd);
  const shiftNodes = useShiftNodes(shifts, lanes, eventStart, {
    onResizeEnd: effectiveReadOnly ? undefined : handleResizeEnd,
    readOnly: effectiveReadOnly,
    onVoteWant,
    onVoteDontWant,
    selectedMemberId,
  });

  const [nodes, setNodes] = useState<Node[]>([]);

  // Merge lane + shift nodes when they change
  useMemo(() => {
    setNodes([...laneNodes, ...shiftNodes]);
  }, [laneNodes, shiftNodes]);

  // Focus viewport on shift nodes when they change
  useEffect(() => {
    if (shiftNodes.length > 0) {
      // Small delay to ensure nodes are rendered in the flow
      const timer = setTimeout(() => {
        fitView({
          nodes: shiftNodes.map((n) => ({ id: n.id })),
          padding: 0.15,
          duration: 300,
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [shiftNodes.length, fitView]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.id.startsWith("shift-")) {
        const data = node.data as ShiftBlockData;
        onShiftSelected?.(data.shiftId);
      }
    },
    [onShiftSelected],
  );

  const handlePaneClick = useCallback(() => {
    onShiftSelected?.(null);
  }, [onShiftSelected]);

  const exportToPng = useCallback(async (): Promise<string | null> => {
    const container = flowContainerRef.current;
    if (!container) return null;
    const target =
      (container.querySelector(".react-flow") as HTMLElement) ?? container;
    if (!target) return null;

    const flowNodes = [...laneNodes, ...shiftNodes];
    if (flowNodes.length === 0) return null;

    const bounds = getNodesBounds(flowNodes);
    const { width, height } = container.getBoundingClientRect();
    const { x, y, zoom } = getViewportForBounds(
      bounds,
      width,
      height,
      MIN_ZOOM,
      MAX_ZOOM,
      0.1,
    );
    setViewport({ x, y, zoom });

    await new Promise((r) => setTimeout(r, 100));

    try {
      return await toPng(target, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
    } catch {
      return null;
    }
  }, [laneNodes, shiftNodes, setViewport]);

  useImperativeHandle(ref, () => ({ exportToPng }), [exportToPng]);

  if (!eventStart || !eventEnd) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-400">
        Select an event to view the calendar
      </div>
    );
  }

  if (lanes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-400">
        <div className="text-center">
          <div className="animate-pulse mb-2">Loading schedule...</div>
          <p className="text-sm">
            If this persists, assign templates in Setup to create lanes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative"
      style={{
        height: "70vh",
        minHeight: 500,
        paddingTop: shiftMutationLocked ? 36 : 0,
      }}
    >
      {shiftMutationLocked && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
          <Shield className="w-4 h-4 flex-shrink-0" />
          {shiftMutationLockedMessage}
        </div>
      )}
      <div ref={flowContainerRef} style={{ height: "100%" }}>
        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDrag={effectiveReadOnly ? undefined : handleNodeDrag}
          onNodeDragStop={
            effectiveReadOnly ? undefined : handleNodeDragStopWithGuides
          }
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onDrop={effectiveReadOnly ? undefined : handleDrop}
          onDragOver={effectiveReadOnly ? undefined : handleDragOver}
          nodesDraggable={!effectiveReadOnly}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          defaultViewport={{ x: 0, y: 0, zoom: DEFAULT_ZOOM }}
          snapToGrid
          snapGrid={[SNAP_PIXELS, LANE_HEIGHT]}
          proOptions={{ hideAttribution: true }}
        >
          <TimeRulerPanel eventStart={eventStart} eventEnd={eventEnd} />
          <Controls position="bottom-right" />
          <MiniMap
            position="bottom-left"
            pannable
            zoomable
            nodeColor={(node) => {
              if (node.type === "shiftBlock")
                return (node.data as ShiftBlockData).color;
              return "transparent";
            }}
            maskColor="rgba(0,0,0,0.15)"
          />
          {/* Alignment guide lines */}
          {alignmentGuides.length > 0 && (
            <AlignmentGuides
              guides={alignmentGuides}
              laneCount={lanes.length}
            />
          )}
        </ReactFlow>
      </div>
    </div>
  );
}

const LaneCalendarCanvasInnerWithRef = forwardRef(
  LaneCalendarCanvasInner,
) as React.ForwardRefExoticComponent<
  LaneCalendarCanvasProps & React.RefAttributes<LaneCalendarCanvasHandle>
>;

/**
 * LaneCalendarCanvas — wrapped in ReactFlowProvider.
 * Exposes exportToPng() via ref for PNG export.
 */
export const LaneCalendarCanvas = forwardRef<
  LaneCalendarCanvasHandle,
  LaneCalendarCanvasProps
>(function LaneCalendarCanvas(props, ref) {
  return (
    <ReactFlowProvider>
      <LaneCalendarCanvasInnerWithRef {...props} ref={ref} />
    </ReactFlowProvider>
  );
});
