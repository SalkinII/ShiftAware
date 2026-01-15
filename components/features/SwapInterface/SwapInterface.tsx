"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeftRight, GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Assignment {
  id: string;
  shiftId: string;
  teamMemberId: string;
  role: string;
  shift: {
    id: string;
    type: string;
    startTime: string;
    endTime: string;
    event: { name: string };
  };
  teamMember: {
    id: string;
    alias: string;
    avatarId: string;
  };
}

interface SwapInterfaceProps {
  assignments: Assignment[];
  onSwap: (
    assignment1Id: string,
    assignment2Id: string,
    reason?: string,
  ) => Promise<void>;
  onRefresh: () => void;
}

interface SortableAssignmentItemProps {
  assignment: Assignment;
  isDragging: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

function SortableAssignmentItem({
  assignment,
  isDragging,
  isSelected,
  onSelect,
}: SortableAssignmentItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: assignment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-move",
        isSelected
          ? "border-primary-500 bg-primary-50"
          : "border-gray-200 bg-white hover:border-gray-300",
        isDragging && "opacity-50",
      )}
      onClick={onSelect}
    >
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">{assignment.teamMember.avatarId}</span>
          <span className="font-bold text-gray-900">
            {assignment.teamMember.alias}
          </span>
          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            {assignment.role.replace("_", " ")}
          </span>
        </div>
        <div className="text-sm text-gray-600">
          <span className="font-semibold">
            {assignment.shift.type.replace("_", " ")}
          </span>
          {" • "}
          <span>
            {format(new Date(assignment.shift.startTime), "MMM d, HH:mm")} —{" "}
            {format(new Date(assignment.shift.endTime), "HH:mm")}
          </span>
        </div>
      </div>
    </div>
  );
}

export function SwapInterface({
  assignments,
  onSwap,
  onRefresh,
}: SwapInterfaceProps) {
  const toast = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSwapping, setIsSwapping] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    // Toggle selection on drop
    const newSelected = new Set(selectedIds);
    if (newSelected.has(active.id as string)) {
      newSelected.delete(active.id as string);
    } else {
      newSelected.add(active.id as string);
    }
    if (newSelected.has(over.id as string)) {
      newSelected.delete(over.id as string);
    } else {
      newSelected.add(over.id as string);
    }
    setSelectedIds(newSelected);
  };

  const handleSwap = async () => {
    if (selectedIds.size !== 2) {
      toast.warning("Please select exactly 2 assignments to swap");
      return;
    }

    const [id1, id2] = Array.from(selectedIds);
    setIsSwapping(true);

    try {
      await onSwap(id1, id2, "Drag-and-drop swap");
      toast.success("Assignments swapped successfully!");
      setSelectedIds(new Set());
      onRefresh();
    } catch (error) {
      console.error("Swap error:", error);
      toast.error("Failed to swap assignments. Please try again.");
    } finally {
      setIsSwapping(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const activeAssignment = activeId
    ? assignments.find((a) => a.id === activeId)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Drag-and-Drop Swap
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Drag assignments to select them, then click Swap to exchange their
            positions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-gray-600">
                {selectedIds.size} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
                disabled={isSwapping}
              >
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
              {selectedIds.size === 2 && (
                <Button
                  onClick={handleSwap}
                  disabled={isSwapping}
                  className="flex items-center gap-2"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Swap Selected
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={assignments.map((a) => a.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {assignments.map((assignment) => (
              <SortableAssignmentItem
                key={assignment.id}
                assignment={assignment}
                isDragging={activeId === assignment.id}
                isSelected={selectedIds.has(assignment.id)}
                onSelect={() => {
                  const newSelected = new Set(selectedIds);
                  if (newSelected.has(assignment.id)) {
                    newSelected.delete(assignment.id);
                  } else {
                    if (newSelected.size >= 2) {
                      toast.warning(
                        "You can only select 2 assignments at a time",
                      );
                      return;
                    }
                    newSelected.add(assignment.id);
                  }
                  setSelectedIds(newSelected);
                }}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeAssignment ? (
            <div className="p-4 rounded-xl border-2 border-primary-500 bg-primary-50 shadow-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {activeAssignment.teamMember.avatarId}
                </span>
                <span className="font-bold text-gray-900">
                  {activeAssignment.teamMember.alias}
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {assignments.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-gray-500">No assignments available to swap</p>
        </Card>
      )}
    </div>
  );
}
