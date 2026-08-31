"use client";

import {
  useCallback,
  useEffect,
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
} from "@xyflow/react";
import { toPng } from "html-to-image";
import "@xyflow/react/dist/style.css";

import { type LaneConfig, UNASSIGNED_LANE_ID } from "@/lib/types/lane";
import { LaneZoneNode } from "./nodes/LaneZoneNode";
import { HourGridNode } from "./nodes/HourGridNode";
import { type ShiftBlockData, ShiftBlockNode } from "./nodes/ShiftBlockNode";
import { MarkerNode } from "./nodes/MarkerNode";
import { TimeRulerPanel } from "./panels/TimeRulerPanel";
import { LaneLabelPanel } from "./panels/LaneLabelPanel";
import { useLaneNodes } from "./hooks/useLaneNodes";
import { useShiftNodes, type ShiftLike } from "./hooks/useShiftNodes";
import { useMarkerNodes, type MarkerLike } from "./hooks/useMarkerNodes";
import { useCanvasActions } from "./hooks/useCanvasActions";
import {
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  LANE_HEIGHT,
  SNAP_PIXELS,
  RULER_HEIGHT,
} from "./utils/constants";
import { useScreenCoordinates } from "./hooks/useScreenCoordinates";
import { Shield } from "lucide-react";

/**
 * Merge updated shift nodes into current React Flow nodes.
 * Preserves React Flow-owned state (position, measured) for existing shift nodes.
 * Lane/grid nodes are always replaced. New shifts are added; deleted shifts removed.
 */
export function mergeNodes(
  currentNodes: Node[],
  laneNodes: Node[],
  newShiftNodes: Node[],
  forceYUpdate = false,
): Node[] {
  const currentShiftMap = new Map<string, Node>();
  for (const node of currentNodes) {
    if (node.id.startsWith("shift-") || node.id.startsWith("marker-")) {
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
          x: existing.position.x,
          y: forceYUpdate ? newNode.position.y : existing.position.y,
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
  marker: MarkerNode,
};

/** Renders vertical alignment guide lines during shift drag */
function AlignmentGuides({ guides }: { guides: number[] }) {
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
  markers?: MarkerLike[] | null;
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
  preferences?: Map<string, "WANT" | "DONT_WANT">;
  /** Rendered top-right over the flow area, below the time ruler (e.g. a mobile swap-pending badge) */
  topRightOverlay?: React.ReactNode;
}

export interface LaneCalendarCanvasHandle {
  exportToPng: () => Promise<string | null>;
}

function LaneCalendarCanvasInner(
  {
    shifts,
    markers = null,
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
    preferences,
    topRightOverlay,
  }: LaneCalendarCanvasProps,
  ref: React.Ref<LaneCalendarCanvasHandle>,
) {
  // Shift mutations are locked if explicitly set OR if readOnly
  const effectiveReadOnly = readOnly || shiftMutationLocked;

  const flowContainerRef = useRef<HTMLDivElement>(null);

  const reorderCountRef = useRef(0);

  // Optimistic lane order: null = use lanes prop as-is (from DB)
  const [optimisticLanes, setOptimisticLanes] = useState<LaneConfig[] | null>(
    null,
  );

  // When lanes prop changes (after refetch), clear optimistic state
  useEffect(() => {
    setOptimisticLanes(null);
  }, [lanes]);

  const orderedLanes = optimisticLanes ?? lanes;

  // One-time cleanup of legacy localStorage lane order
  useEffect(() => {
    if (!eventId) return;
    localStorage.removeItem(`shiftaware:laneOrder:${eventId}`);
  }, [eventId]);

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

    // Build reordered lanes with updated order values
    const reordered = next.map((lane, i) => ({ ...lane, order: i }));
    const unassigned = orderedLanes.find((l) => l.id === UNASSIGNED_LANE_ID);
    if (unassigned) reordered.push(unassigned);

    // Optimistic update for instant feedback
    reorderCountRef.current += 1;
    setOptimisticLanes(reordered);

    // Persist to database
    if (eventId) {
      const order = next.map((lane, i) => ({
        templateId: lane.templateId!,
        order: i,
      }));
      fetch(`/api/events/${eventId}/templates/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      }).then(() => {
        // Trigger parent to refetch templates (updates lanes prop from DB)
        onShiftUpdated?.();
      });
    }
  }

  const handleMarkerSave = useCallback(async (markerId: string, text: string) => {
    await fetch(`/api/markers/${markerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    onShiftUpdated?.();
  }, [onShiftUpdated]);

  const handleMarkerDelete = useCallback(async (markerId: string) => {
    await fetch(`/api/markers/${markerId}`, { method: "DELETE" });
    onShiftUpdated?.();
  }, [onShiftUpdated]);

  const { fitView } = useReactFlow();
  const laneNodes = useLaneNodes(orderedLanes, eventStart, eventEnd);
  const canvasHeight = orderedLanes.length * LANE_HEIGHT;
  const shiftNodes = useShiftNodes(shifts, orderedLanes, eventStart, {
    onResizeEnd: effectiveReadOnly ? undefined : handleResizeEnd,
    readOnly: effectiveReadOnly,
    onVoteWant: effectiveReadOnly ? onVoteWant : undefined,
    onVoteDontWant: effectiveReadOnly ? onVoteDontWant : undefined,
    selectedMemberId,
    preferences,
  });

  const markerNodes = useMarkerNodes(markers, orderedLanes, eventStart, {
    readOnly: effectiveReadOnly,
    onSave: effectiveReadOnly ? undefined : handleMarkerSave,
    onDelete: effectiveReadOnly ? undefined : handleMarkerDelete,
    onResizeEnd: effectiveReadOnly ? undefined : handleResizeEnd,
  });

  const [nodes, setNodes] = useState<Node[]>([]);

  const lastReorderCountRef = useRef(0);

  // Merge shift + marker nodes into current state, preserving React Flow position during drag
  useEffect(() => {
    const forceY = reorderCountRef.current !== lastReorderCountRef.current;
    lastReorderCountRef.current = reorderCountRef.current;
    setNodes((current) => mergeNodes(current, laneNodes, [...shiftNodes, ...markerNodes], forceY));
  }, [laneNodes, shiftNodes, markerNodes]);

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

    const { width, height } = target.getBoundingClientRect();

    // Wrapper positions the clone off-screen so the user sees no change.
    // The clone itself has no off-screen offset — html-to-image serialises it
    // into a <foreignObject>, where `position:fixed` becomes `position:absolute`,
    // so any left/top on the captured element would shift the image off-canvas.
    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, {
      position: "fixed",
      top: "0",
      left: `-${width + 10}px`,
      width: `${width}px`,
      height: `${height}px`,
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: "-1",
    });
    document.body.appendChild(wrapper);

    const clone = target.cloneNode(true) as HTMLElement;
    // No viewport mutation on the clone — TimeRulerPanel and LaneLabelPanel
    // bake pixel positions from useViewport() at React render time. Changing
    // the CSS transform after cloning would move nodes but not the panels,
    // causing misalignment. Capturing at the current live viewport guarantees
    // panels and nodes are always in sync.
    Object.assign(clone.style, {
      position: "relative",
      top: "0",
      left: "0",
      width: `${width}px`,
      height: `${height}px`,
    });
    wrapper.appendChild(clone);

    // Two frames to let the browser lay out the clone
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    try {
      return await toPng(clone, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        width,
        height,
        skipFonts: true,
      });
    } catch (e) {
      console.error("[exportToPng] html-to-image failed:", e);
      return null;
    } finally {
      document.body.removeChild(wrapper);
    }
  }, []);

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
      className="relative flex flex-col"
      style={{ height: "80vh", minHeight: 600 }}
    >
      {shiftMutationLocked && (
        <div
          data-testid="shift-mutation-locked-banner"
          className="flex-shrink-0 z-10 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center gap-2"
        >
          <Shield className="w-4 h-4 flex-shrink-0" />
          {shiftMutationLockedMessage}
        </div>
      )}
      <div ref={flowContainerRef} className="relative flex-1 min-h-0">
        {topRightOverlay && (
          <div
            data-testid="canvas-top-right-overlay"
            className="absolute right-3 z-20"
            style={{ top: RULER_HEIGHT + 12 }}
          >
            {topRightOverlay}
          </div>
        )}
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
