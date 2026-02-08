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
import { unwrapApiResponse } from "@/lib/api-errors";
import {
  ArrowLeftRight,
  GripVertical,
  X,
  Filter,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import CalendarView from "@/components/features/Calendar/CalendarView";
import { format, startOfDay, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

// Lazy load ConflictWizard
const ConflictWizard = dynamic(
  () =>
    import("@/components/features/ConflictWizard/ConflictWizard").then(
      (mod) => mod.ConflictWizard,
    ),
  { ssr: false },
);

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
    capacity?: number;
    priority?: string;
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
  const [viewMode, setViewMode] = useState<"cards" | "calendar">("cards");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSwapping, setIsSwapping] = useState(false);
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterPerson, setFilterPerson] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [activeSwapShift, setActiveSwapShift] = useState<any | null>(null);
  const [conflictCount, setConflictCount] = useState<number | null>(null);
  const [showConflictWizard, setShowConflictWizard] = useState(false);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

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

  const filteredAssignments = useMemo(() => {
    let filtered = assignments;

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

    return filtered;
  }, [assignments, filterDate, filterPerson, filterType]);

  // Filter and group assignments
  const filteredAndGrouped = useMemo(() => {
    const grouped = new Map<string, Assignment[]>();
    filteredAssignments.forEach((assignment) => {
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
  }, [filteredAssignments]);

  const shiftsForCalendar = useMemo(() => {
    const map = new Map<string, any>();
    filteredAssignments.forEach((assignment) => {
      if (!map.has(assignment.shiftId)) {
        const fallbackCapacity = Math.max(assignment.shift.capacity || 0, 1);
        map.set(assignment.shiftId, {
          id: assignment.shiftId,
          type: assignment.shift.type,
          startTime: assignment.shift.startTime,
          endTime: assignment.shift.endTime,
          capacity: assignment.shift.capacity ?? fallbackCapacity,
          priority: assignment.shift.priority,
          event: assignment.shift.event,
          assignments: [],
        });
      }
      map.get(assignment.shiftId).assignments.push(assignment);
    });
    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
  }, [filteredAssignments]);

  const calendarStartDate = useMemo(() => {
    if (shiftsForCalendar.length === 0) return undefined;
    const first = shiftsForCalendar[0];
    return format(new Date(first.startTime), "yyyy-MM-dd");
  }, [shiftsForCalendar]);

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
    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Toggle active item
    if (newSelected.has(activeIdStr)) {
      newSelected.delete(activeIdStr);
    } else {
      if (newSelected.size >= 2) {
        toast.warning("You can only select 2 assignments at a time");
        return;
      }
      newSelected.add(activeIdStr);
    }

    // Toggle over item (if different from active)
    if (overIdStr !== activeIdStr) {
      if (newSelected.has(overIdStr)) {
        newSelected.delete(overIdStr);
      } else {
        if (newSelected.size >= 2) {
          toast.warning("You can only select 2 assignments at a time");
          return;
        }
        newSelected.add(overIdStr);
      }
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

  const checkConflicts = async () => {
    setCheckingConflicts(true);
    try {
      const res = await fetch("/api/conflicts");
      if (res.ok) {
        const raw = await res.json();
        const data = unwrapApiResponse<{
          conflicts: any[];
          summary: { total: number };
        }>(raw);
        const count = data?.summary?.total || 0;
        setConflictCount(count);
        return count > 0;
      }
    } catch (error) {
      console.error("Failed to check conflicts:", error);
    } finally {
      setCheckingConflicts(false);
    }
    return false;
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

      // Check for conflicts after swap
      const hasConflicts = await checkConflicts();
      if (hasConflicts) {
        toast.warning(
          "Conflicts detected after swap. Review and resolve.",
          5000,
        );
      }
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
          {conflictCount !== null && conflictCount > 0 && (
            <Button
              variant="secondary"
              onClick={() => setShowConflictWizard(true)}
              className="flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span>
                {conflictCount} Conflict{conflictCount !== 1 ? "s" : ""}
              </span>
            </Button>
          )}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {(["cards", "calendar"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-widest transition-all",
                  viewMode === mode
                    ? "bg-primary-500 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700",
                )}
              >
                {mode === "cards" ? "Cards" : "Calendar"}
              </button>
            ))}
          </div>
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

      {viewMode === "cards" ? (
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
                      {format(
                        new Date(activeAssignment.shift.endTime),
                        "HH:mm",
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="space-y-4">
          <Card className="p-0 shadow-sm overflow-hidden">
            <CalendarView
              shifts={shiftsForCalendar}
              viewType="Week"
              startDate={calendarStartDate}
              showAssignments={true}
              onAssignmentClick={(shift) => setActiveSwapShift(shift)}
            />
          </Card>

          {activeSwapShift ? (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    {activeSwapShift.type.replace("_", " ")} Assignments
                  </h3>
                  <p className="text-xs text-gray-500">
                    {format(
                      new Date(activeSwapShift.startTime),
                      "MMM d, HH:mm",
                    )}
                  </p>
                </div>
                <span className="text-xs text-gray-500">
                  {activeSwapShift.assignments?.length || 0} assigned
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(activeSwapShift.assignments || []).map(
                  (assignment: Assignment) => (
                    <div
                      key={assignment.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                        selectedIds.has(assignment.id)
                          ? "border-primary-500 bg-primary-50"
                          : "border-gray-200 bg-white hover:border-gray-300",
                      )}
                      onClick={() => handleCardClick(assignment.id)}
                    >
                      <div className="text-2xl">
                        {assignment.teamMember.avatarId}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-900 truncate">
                          {assignment.teamMember.alias}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {assignment.role.replace("_", " ")}
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-4 text-center text-sm text-gray-500">
              Select a shift on the calendar to view assignments.
            </Card>
          )}
        </div>
      )}

      {/* Conflict Wizard */}
      <ConflictWizard
        isOpen={showConflictWizard}
        onClose={() => {
          setShowConflictWizard(false);
          checkConflicts(); // Refresh conflict count after wizard closes
        }}
      />
    </div>
  );
}
