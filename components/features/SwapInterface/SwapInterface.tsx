"use client";

import { useState, useMemo } from "react";
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
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeftRight, GripVertical, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { format, startOfDay, parseISO, isSameDay } from "date-fns";
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

interface CompactAssignmentCardProps {
  assignment: Assignment;
  isDragging: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

function CompactAssignmentCard({
  assignment,
  isDragging,
  isSelected,
  onSelect,
}: CompactAssignmentCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isDraggableDragging,
  } = useDraggable({
    id: assignment.id,
    data: {
      type: "assignment",
      assignment,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative p-3 rounded-lg border-2 transition-all cursor-pointer",
        "hover:shadow-md hover:border-gray-300",
        isSelected
          ? "border-primary-500 bg-primary-50 shadow-sm"
          : "border-gray-200 bg-white",
        (isDragging || isDraggableDragging) && "opacity-50 z-50",
      )}
      onClick={onSelect}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <div className="flex items-start gap-2 pr-6">
        <span className="text-xl flex-shrink-0">
          {assignment.teamMember.avatarId}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 truncate">
            {assignment.teamMember.alias}
          </div>
          <div className="text-xs text-gray-600 mt-0.5">
            {format(new Date(assignment.shift.startTime), "HH:mm")} —{" "}
            {format(new Date(assignment.shift.endTime), "HH:mm")}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
              {assignment.shift.type.replace("_", " ")}
            </span>
            <span className="text-xs text-gray-400">
              {assignment.role.replace("_", " ")}
            </span>
          </div>
        </div>
      </div>

      {isSelected && (
        <div className="absolute top-1 left-1 w-2 h-2 bg-primary-500 rounded-full" />
      )}
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
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterPerson, setFilterPerson] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor),
  );

  // Extract unique values for filters
  const uniqueDates = useMemo(() => {
    const dates = new Set<string>();
    assignments.forEach((a) => {
      const date = format(
        startOfDay(parseISO(a.shift.startTime)),
        "yyyy-MM-dd",
      );
      dates.add(date);
    });
    return Array.from(dates).sort();
  }, [assignments]);

  const uniquePeople = useMemo(() => {
    const people = new Set<string>();
    assignments.forEach((a) => {
      people.add(a.teamMember.id);
    });
    return Array.from(people)
      .map((id) => {
        const assignment = assignments.find((a) => a.teamMember.id === id);
        return { id, name: assignment?.teamMember.alias || "" };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [assignments]);

  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    assignments.forEach((a) => {
      types.add(a.shift.type);
    });
    return Array.from(types).sort();
  }, [assignments]);

  // Filter and group assignments
  const filteredAndGrouped = useMemo(() => {
    let filtered = assignments;

    // Apply filters
    if (filterDate) {
      filtered = filtered.filter((a) => {
        const date = format(
          startOfDay(parseISO(a.shift.startTime)),
          "yyyy-MM-dd",
        );
        return date === filterDate;
      });
    }

    if (filterPerson) {
      filtered = filtered.filter((a) => a.teamMember.id === filterPerson);
    }

    if (filterType) {
      filtered = filtered.filter((a) => a.shift.type === filterType);
    }

    // Group by date
    const grouped = new Map<string, Assignment[]>();
    filtered.forEach((assignment) => {
      const dateKey = format(
        startOfDay(parseISO(assignment.shift.startTime)),
        "yyyy-MM-dd",
      );
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(assignment);
    });

    // Sort within each date by start time
    grouped.forEach((assignments, dateKey) => {
      assignments.sort((a, b) => {
        return (
          new Date(a.shift.startTime).getTime() -
          new Date(b.shift.startTime).getTime()
        );
      });
    });

    // Convert to array and sort by date
    return Array.from(grouped.entries())
      .map(([date, items]) => ({
        date,
        assignments: items,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [assignments, filterDate, filterPerson, filterType]);

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
      if (newSelected.size >= 2) {
        toast.warning("You can only select 2 assignments at a time");
        return;
      }
      newSelected.add(active.id as string);
    }
    if (newSelected.has(over.id as string)) {
      newSelected.delete(over.id as string);
    } else {
      if (newSelected.size >= 2 && !newSelected.has(active.id as string)) {
        toast.warning("You can only select 2 assignments at a time");
        return;
      }
      newSelected.add(over.id as string);
    }
    setSelectedIds(newSelected);
  };

  const handleCardClick = (assignmentId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(assignmentId)) {
      newSelected.delete(assignmentId);
    } else {
      if (newSelected.size >= 2) {
        toast.warning("You can only select 2 assignments at a time");
        return;
      }
      newSelected.add(assignmentId);
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

  const handleClearFilters = () => {
    setFilterDate("");
    setFilterPerson("");
    setFilterType("");
  };

  const activeAssignment = activeId
    ? assignments.find((a) => a.id === activeId)
    : null;

  const selectedAssignments = Array.from(selectedIds)
    .map((id) => assignments.find((a) => a.id === id))
    .filter(Boolean) as Assignment[];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Swap Assignments</h2>
          <p className="text-sm text-gray-600 mt-1">
            Select 2 assignments to swap. Drag or click to select.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-gray-600">
                {selectedIds.size} selected
              </span>
              <Button
                variant="secondary"
                onClick={handleClearSelection}
                disabled={isSwapping}
                size="sm"
              >
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
              {selectedIds.size === 2 && (
                <Button onClick={handleSwap} disabled={isSwapping}>
                  <ArrowLeftRight className="w-4 h-4 mr-2" />
                  Swap Selected
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="Date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          >
            <option value="">All dates</option>
            {uniqueDates.map((date) => (
              <option key={date} value={date}>
                {format(parseISO(date), "MMM d, yyyy")}
              </option>
            ))}
          </Select>
          <Select
            label="Person"
            value={filterPerson}
            onChange={(e) => setFilterPerson(e.target.value)}
          >
            <option value="">All people</option>
            {uniquePeople.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
          <Select
            label="Shift Type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All types</option>
            {uniqueTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        {(filterDate || filterPerson || filterType) && (
          <div className="mt-3">
            <Button variant="secondary" onClick={handleClearFilters} size="sm">
              <X className="w-3 h-3 mr-1" />
              Clear Filters
            </Button>
          </div>
        )}
      </Card>

      {/* Swap Preview */}
      {selectedAssignments.length === 2 && (
        <Card className="p-4 bg-primary-50 border-primary-200">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-xs text-gray-600 mb-1">From</div>
              <div className="font-semibold text-sm text-gray-900">
                {selectedAssignments[0].teamMember.alias} •{" "}
                {format(
                  new Date(selectedAssignments[0].shift.startTime),
                  "MMM d, HH:mm",
                )}
              </div>
            </div>
            <ArrowLeftRight className="w-5 h-5 text-primary-600 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-gray-600 mb-1">To</div>
              <div className="font-semibold text-sm text-gray-900">
                {selectedAssignments[1].teamMember.alias} •{" "}
                {format(
                  new Date(selectedAssignments[1].shift.startTime),
                  "MMM d, HH:mm",
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Grid View */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {filteredAndGrouped.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-500">
              {assignments.length === 0
                ? "No assignments available to swap"
                : "No assignments match the selected filters"}
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {filteredAndGrouped.map(
              ({ date, assignments: dateAssignments }) => (
                <div key={date} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900">
                      {format(parseISO(date), "EEEE, MMMM d, yyyy")}
                    </h3>
                    <span className="text-sm text-gray-500">
                      ({dateAssignments.length} assignment
                      {dateAssignments.length !== 1 ? "s" : ""})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {dateAssignments.map((assignment) => (
                      <CompactAssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        isDragging={activeId === assignment.id}
                        isSelected={selectedIds.has(assignment.id)}
                        onSelect={() => handleCardClick(assignment.id)}
                      />
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        )}

        <DragOverlay>
          {activeAssignment ? (
            <div className="p-3 rounded-lg border-2 border-primary-500 bg-primary-50 shadow-lg max-w-xs">
              <div className="flex items-start gap-2">
                <span className="text-xl">
                  {activeAssignment.teamMember.avatarId}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-900">
                    {activeAssignment.teamMember.alias}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {format(
                      new Date(activeAssignment.shift.startTime),
                      "HH:mm",
                    )}{" "}
                    —{" "}
                    {format(new Date(activeAssignment.shift.endTime), "HH:mm")}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
