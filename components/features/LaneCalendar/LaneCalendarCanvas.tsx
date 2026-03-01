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

import { type LaneConfig, UNASSIGNED_LANE_ID } from "@/lib/types/lane";
import { LaneZoneNode } from "./nodes/LaneZoneNode";
import { HourGridNode } from "./nodes/HourGridNode";
import { type ShiftBlockData, ShiftBlockNode } from "./nodes/ShiftBlockNode";
import { TimeRulerPanel } from "./panels/TimeRulerPanel";
import { LaneLabelPanel } from "./panels/LaneLabelPanel";
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
import { useScreenCoordinates } from "./hooks/useScreenCoordinates";
import { Shield } from "lucide-react";

/**
 * Merge updated shift nodes into current React Flow nodes.
 * Preserves React Flow-owned state (position, measured) for existing shift nodes.
 * Lane/grid nodes are always replaced. New shifts are added; deleted shifts removed.
 */
function mergeNodes(
  currentNodes: Node[],
  laneNodes: Node[],
  newShiftNodes: Node[],
): Node[] {
  const currentShiftMap = new Map<string, Node>();
  for (const node of currentNodes) {
    if (node.id.startsWith("shift-")) {
      currentShiftMap.set(node.id, node);
    }
  }

  const mergedShifts = newShiftNodes.map((newNode) => {
    const existing = currentShiftMap.get(newNode.id);
    if (existing) {
      return {
        ...existing,
        data: newNode.data,
        style: newNode.style,
        position: {
          x: existing.position.x,   // Preserve X (time axis, may be mid-drag)
          y: existing.position.y,   // Preserve Y (lane) — avoid overwriting drag-updated position
        },
      };
    }
    return newNode;
  });

  return [...laneNodes, ...mergedShifts];
}

const nodeTypes = {
  laneZone: LaneZoneNode,
  hourGrid: HourGridNode,
  shiftBlock: ShiftBlockNode,
};

/** Renders vertical alignment guide lines during shift drag */
function AlignmentGuides({
  guides,
}: {
  guides: number[];
}) {
  const { flowToScreenX } = useScreenCoordinates();

  return (
    <Panel
      position="top-left"
      className="!m-0 !p-0 !inset-0 !w-full !h-full !transform-none pointer-events-none"
    >
      {guides.map((flowX, i) => {
        const screenX = flowToScreenX(flowX);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: screenX,
              transform: "translateX(-50%)",
              top: 0,
              bottom: 0,
              width: 0,
              borderLeft: "2px dashed #3b82f6",
              opacity: 0.7,
              pointerEvents: "none",
            }}
          />
        );
      })}
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

  const [laneOrderOverride, setLaneOrderOverride] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    if (!eventId) return;
    const stored = localStorage.getItem(`shiftaware:laneOrder:${eventId}`);
    if (stored) {
      try {
        setLaneOrderOverride(JSON.parse(stored));
      } catch {
        // Ignore invalid JSON
      }
    } else {
      setLaneOrderOverride({});
    }
  }, [eventId]);

  const orderedLanes = useMemo(() => {
    if (Object.keys(laneOrderOverride).length === 0) return lanes;
    return [...lanes]
      .map((lane) => ({
        ...lane,
        order:
          lane.id in laneOrderOverride ? laneOrderOverride[lane.id] : lane.order,
      }))
      .sort((a, b) => a.order - b.order);
  }, [lanes, laneOrderOverride]);

  const {
    handleDrop,
    handleDragOver,
    handleNodeDragStop,
    handleResizeEnd,
    handleNodeDrag,
    clearAlignmentGuides,
    alignmentGuides,
  } = useCanvasActions({
    lanes: orderedLanes,
    eventStart,
    eventId,
    onShiftCreated,
    onShiftUpdated,
  });

  const handleNodeDragStopWithGuides = useCallback(
    (event: React.MouseEvent, node: Node) => {
      clearAlignmentGuides();
      handleNodeDragStop(event, node).catch(() => {
        // Errors already handled inside handleNodeDragStop via toast
      });
    },
    [clearAlignmentGuides, handleNodeDragStop],
  );

  function handleReorder(laneId: string, direction: "up" | "down") {
    const sortable = orderedLanes.filter((l) => l.id !== UNASSIGNED_LANE_ID);
    const idx = sortable.findIndex((l) => l.id === laneId);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortable.length) return;

    const next = [...sortable];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];

    const newOverride: Record<string, number> = {};
    next.forEach((lane, i) => {
      newOverride[lane.id] = i;
    });

    setLaneOrderOverride(newOverride);
    if (eventId) {
      localStorage.setItem(
        `shiftaware:laneOrder:${eventId}`,
        JSON.stringify(newOverride),
      );
    }
  }

  const { setViewport: setFlowViewport, getViewport, fitView } = useReactFlow();
  const laneNodes = useLaneNodes(orderedLanes, eventStart, eventEnd);
  const canvasHeight = orderedLanes.length * LANE_HEIGHT;
  const shiftNodes = useShiftNodes(shifts, orderedLanes, eventStart, {
    onResizeEnd: effectiveReadOnly ? undefined : handleResizeEnd,
    readOnly: effectiveReadOnly,
    onVoteWant: effectiveReadOnly ? onVoteWant : undefined,
    onVoteDontWant: effectiveReadOnly ? onVoteDontWant : undefined,
    selectedMemberId,
  });

  const [nodes, setNodes] = useState<Node[]>([]);

  // Merge shift nodes into current state, preserving React Flow position during drag
  useEffect(() => {
    setNodes((current) => mergeNodes(current, laneNodes, shiftNodes));
  }, [laneNodes, shiftNodes]);

  // fitView only on initial load and event change — never on refetch
  const fitViewDoneRef = useRef<string | null>(null);

  useEffect(() => {
    if (shiftNodes.length > 0 && fitViewDoneRef.current !== eventId) {
      fitViewDoneRef.current = eventId;
      const timer = setTimeout(() => {
        fitView({ padding: 0.15, duration: 300 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [shiftNodes.length, eventId, fitView]);

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

    // Save current viewport from React Flow's internal state (always current)
    const savedViewport = getViewport();

    // Compute viewport that fits all nodes
    const bounds = getNodesBounds(flowNodes);
    const { width, height } = container.getBoundingClientRect();
    const exportViewport = getViewportForBounds(
      bounds,
      width,
      height,
      MIN_ZOOM,
      MAX_ZOOM,
      0.1,
    );

    // Set export viewport and wait for DOM to update
    setFlowViewport(exportViewport);
    await new Promise((r) => setTimeout(r, 150));

    try {
      return await toPng(target, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
    } catch {
      return null;
    } finally {
      // Restore from the imperative snapshot — always accurate
      setFlowViewport(savedViewport);
    }
  }, [laneNodes, shiftNodes, getViewport, setFlowViewport]);

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
        height: "80vh",
        minHeight: 600,
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
          <LaneLabelPanel
            lanes={orderedLanes}
            canvasHeight={canvasHeight}
            onReorder={!shiftMutationLocked ? handleReorder : undefined}
          />
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
            <AlignmentGuides guides={alignmentGuides} />
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
