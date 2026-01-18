"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronRight,
  RefreshCw,
  User,
  ShieldCheck,
  Clock,
  Users,
  SlidersHorizontal,
  AlertTriangle,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  closestCenter,
  useDndMonitor,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import CalendarView from "@/components/features/Calendar/CalendarView";
import { TemplatePalette } from "@/components/features/TemplatePalette/TemplatePalette";
import { addDays, format, parseISO, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useCache } from "@/lib/cache/useCache";
import { unwrapApiResponse } from "@/lib/api-errors";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import dynamic from "next/dynamic";
import {
  ModifySlotDialog,
  type ModifiedSlotData,
  type ShiftTemplate,
} from "@/components/features/ModifySlotDialog/ModifySlotDialog";

interface EventWithConfig {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  config: {
    bufferDaysBefore: number;
    bufferDaysAfter: number;
    minShiftsPerPerson: number;
  } | null;
}

// PDF export will be lazy-loaded on demand (heavy library - jspdf ~200KB)
// Lazy load ConflictWizard
const ConflictWizard = dynamic(
  () =>
    import("@/components/features/ConflictWizard/ConflictWizard").then(
      (mod) => mod.ConflictWizard,
    ),
  { ssr: false },
);

type CoverageState = "full" | "partial" | "empty";

interface Assignment {
  id: string;
  role: string;
  assignmentType: string;
  teamMember: { id: string; alias: string; avatarId: string };
  algorithmScore?: { overall?: number } | null;
  notes?: string | null;
}

interface Shift {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  priority: string;
  capacity: number;
  desirabilityScore?: number;
  assignments: Assignment[];
  requiredRoles?: { role: string; count: number }[];
  event: { name: string; id: string };
}

const coverageLegend: Record<
  CoverageState,
  { label: string; badge: string; bg: string; text: string }
> = {
  full: {
    label: "Fully Staffed",
    badge: "bg-success-500",
    bg: "bg-success-50",
    text: "text-success-700",
  },
  partial: {
    label: "Partially Staffed",
    badge: "bg-accent-500",
    bg: "bg-accent-50",
    text: "text-accent-700",
  },
  empty: {
    label: "Unstaffed",
    badge: "bg-red-500",
    bg: "bg-red-50",
    text: "text-red-700",
  },
};

export default function SchedulePage() {
  const toast = useToast();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<"Day" | "Week" | "Grid">("Week");
  const [currentEventDate, setCurrentEventDate] = useState<string>();
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<any>(null);
  const [activeShiftDrag, setActiveShiftDrag] = useState<Shift | null>(null);
  const [showTemplatePalette, setShowTemplatePalette] = useState(false);
  const [conflictCount, setConflictCount] = useState<number | null>(null);
  const [showConflictWizard, setShowConflictWizard] = useState(false);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [dragOverInfo, setDragOverInfo] = useState<{
    date: string | null;
    x: number;
    y: number;
  } | null>(null);
  const [showTimeEditor, setShowTimeEditor] = useState(false);
  const [editedStartTime, setEditedStartTime] = useState<string>("");
  const [editedEndTime, setEditedEndTime] = useState<string>("");

  // Modify Slot Dialog state
  const [modifySlotDialog, setModifySlotDialog] = useState<{
    isOpen: boolean;
    template: ShiftTemplate | null;
    targetDate: Date | null;
    isLoading: boolean;
  }>({
    isOpen: false,
    template: null,
    targetDate: null,
    isLoading: false,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    shiftId: string | null;
    shiftName: string;
    isLoading: boolean;
  }>({
    isOpen: false,
    shiftId: null,
    shiftName: "",
    isLoading: false,
  });

  const [coverageFilter, setCoverageFilter] = useState<CoverageState | "all">(
    "all",
  );
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [memberFilter, setMemberFilter] = useState<string>("all");

  const eventRange = useMemo(() => {
    if (shifts.length === 0) return null;
    const dates = shifts.map((shift) => shift.startTime.split("T")[0]).sort();
    return { start: dates[0], end: dates[dates.length - 1] };
  }, [shifts]);

  // Use cache for shifts data
  const {
    data: cachedShifts,
    loading: cacheLoading,
    refetch: refetchShifts,
  } = useCache<Shift[]>({
    key: "shifts",
    fetchFn: async () => {
      const res = await fetch("/api/shifts");
      if (!res.ok) throw new Error("Failed to fetch shifts");
      const data = await res.json();
      return unwrapApiResponse<Shift[]>(data);
    },
  });

  // Fetch current event with config for calendar anchoring
  const { data: eventData } = useCache<EventWithConfig>({
    key: "current-event",
    fetchFn: async () => {
      const res = await fetch("/api/events/current");
      if (!res.ok) throw new Error("Failed to fetch current event");
      const data = await res.json();
      return unwrapApiResponse<EventWithConfig>(data);
    },
  });

  useEffect(() => {
    const savedView = localStorage.getItem("shiftaware:schedule:view");
    if (savedView === "Day" || savedView === "Week" || savedView === "Grid") {
      setViewType(savedView);
    }

    // Listen for custom event to refresh schedule
    const handleRefresh = () => {
      refetchShifts();
    };
    window.addEventListener("shiftaware:refresh-schedule", handleRefresh);
    return () => {
      window.removeEventListener("shiftaware:refresh-schedule", handleRefresh);
    };
  }, [refetchShifts]);

  // Update shifts when cache data changes
  useEffect(() => {
    if (cachedShifts) {
      setShifts(cachedShifts);
      setLoading(false);
    } else if (!cacheLoading) {
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [cachedShifts, cacheLoading]);

  // Set calendar anchor date based on event config (with buffer) or fallback to earliest shift
  useEffect(() => {
    if (eventData?.startDate) {
      // Use festival start date with buffer
      const bufferDays = eventData.config?.bufferDaysBefore || 0;
      const festivalStart = addDays(new Date(eventData.startDate), -bufferDays);
      setCurrentEventDate(format(festivalStart, "yyyy-MM-dd"));
    } else if (shifts.length > 0) {
      // Fallback: use earliest shift date
      const earliest = shifts.reduce(
        (earliestDate: string | undefined, shift: Shift) => {
          const start = shift.startTime.split("T")[0];
          if (!earliestDate) return start;
          return new Date(start) < new Date(earliestDate)
            ? start
            : earliestDate;
        },
        undefined as string | undefined,
      );
      setCurrentEventDate(earliest);
    }
  }, [eventData, shifts]);

  useEffect(() => {
    localStorage.setItem("shiftaware:schedule:view", viewType);
  }, [viewType]);

  // Get current event from shifts
  const currentEvent = useMemo(() => {
    if (shifts.length === 0) return null;
    return shifts[0].event;
  }, [shifts]);

  // Check for conflicts
  const checkConflicts = async () => {
    setCheckingConflicts(true);
    try {
      const res = await fetch("/api/conflicts");
      if (res.ok) {
        const data = await res.json();
        const count = data.summary?.total || 0;
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

  // Check conflicts when shifts are loaded or refreshed
  useEffect(() => {
    if (shifts.length > 0 && !loading) {
      checkConflicts();
    }
  }, [shifts.length, loading]);

  async function handleDragEnd(event: DragEndEvent) {
    setDragOverInfo(null);
    const { active, over } = event;
    setActiveTemplate(null);
    setActiveShiftDrag(null);

    if (!over || !active.data.current) {
      console.log("Drag end: no over or no data", {
        over: over?.id,
        active: active.id,
      });
      return;
    }

    const dropId = over.id as string;
    console.log("Drag end:", {
      dropId,
      activeId: active.id,
      overData: over.data.current,
    });

    if (!dropId.startsWith("date-")) {
      console.log("Drop ID doesn't start with 'date-':", dropId);
      return;
    }
    const dateStr = dropId.replace("date-", "");

    const template = active.data.current.template;
    const shift = active.data.current.shift as Shift | undefined;

    if (template) {
      if (!currentEvent) {
        toast.error("No event selected. Please ensure shifts are loaded.");
        return;
      }

      const dropDate = parseISO(dateStr);

      // Open Modify Slot dialog instead of immediate creation
      setModifySlotDialog({
        isOpen: true,
        template: template as ShiftTemplate,
        targetDate: dropDate,
        isLoading: false,
      });

      return;
    }

    if (shift) {
      const currentDateStr = shift.startTime.split("T")[0];
      if (currentDateStr === dateStr) return;

      const start = new Date(shift.startTime);
      const end = new Date(shift.endTime);
      const durationMs = end.getTime() - start.getTime();

      const dropDate = parseISO(dateStr);
      const newStart = new Date(dropDate);
      newStart.setHours(
        start.getHours(),
        start.getMinutes(),
        start.getSeconds(),
        start.getMilliseconds(),
      );
      // Snap to 15-minute intervals
      const startMinutes = newStart.getMinutes();
      const snappedMinutes = Math.round(startMinutes / 15) * 15;
      newStart.setMinutes(snappedMinutes);
      newStart.setSeconds(0);
      newStart.setMilliseconds(0);

      const newEnd = new Date(newStart.getTime() + durationMs);
      // Snap end time to 15-minute intervals
      const endMinutes = newEnd.getMinutes();
      const snappedEndMinutes = Math.round(endMinutes / 15) * 15;
      newEnd.setMinutes(snappedEndMinutes);
      newEnd.setSeconds(0);
      newEnd.setMilliseconds(0);

      try {
        const res = await fetch(`/api/shifts/${shift.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startTime: newStart.toISOString(),
            endTime: newEnd.toISOString(),
          }),
        });

        if (res.ok) {
          toast.success("Shift rescheduled");
          refetchShifts();
          window.dispatchEvent(
            new CustomEvent("shiftaware:cache-invalidate", {
              detail: { keys: ["shifts", "shifts*"] },
            }),
          );
          // Check for conflicts after rescheduling
          const hasConflicts = await checkConflicts();
          if (hasConflicts) {
            toast.warning(
              "Conflicts detected after reschedule. Review and resolve.",
              5000,
            );
          }
        } else {
          const errorData = await res.json();
          toast.error(errorData.error || "Failed to reschedule shift");
        }
      } catch (error) {
        console.error("Failed to reschedule shift:", error);
        toast.error("Failed to reschedule shift. Please try again.");
      }
    }
  }

  function handleDragStart(event: DragStartEvent) {
    if (event.active.data.current?.template) {
      setActiveTemplate(event.active.data.current.template);
      return;
    }
    if (event.active.data.current?.shift) {
      setActiveShiftDrag(event.active.data.current.shift);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { over, activatorEvent } = event;
    if (!over || !activatorEvent) {
      setDragOverInfo(null);
      return;
    }

    const dropId = over.id as string;
    if (!dropId.startsWith("date-")) {
      setDragOverInfo(null);
      return;
    }

    const dateStr = dropId.replace("date-", "");
    const mouseEvent = activatorEvent as MouseEvent;

    setDragOverInfo({
      date: dateStr,
      x: mouseEvent.clientX,
      y: mouseEvent.clientY,
    });
  }

  function coverageState(shift: Shift): CoverageState {
    const filled = shift.assignments?.length || 0;
    if (filled >= shift.capacity) return "full";
    if (filled > 0) return "partial";
    return "empty";
  }

  // Handle ModifySlotDialog confirmation
  async function handleModifySlotConfirm(modifiedData: ModifiedSlotData) {
    if (!modifySlotDialog.template || !currentEvent) return;

    setModifySlotDialog((prev) => ({ ...prev, isLoading: true }));

    try {
      // Build shift times from modified data
      const [startHours, startMins] = modifiedData.startTime
        .split(":")
        .map(Number);
      const [endHours, endMins] = modifiedData.endTime.split(":").map(Number);

      const startTime = new Date(modifiedData.date);
      startTime.setHours(startHours, startMins, 0, 0);

      const endTime = new Date(modifiedData.date);
      endTime.setHours(endHours, endMins, 0, 0);

      // Calculate duration in minutes
      const durationMinutes =
        (endTime.getTime() - startTime.getTime()) / (1000 * 60);

      // Create shift directly with modified values
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: currentEvent.id,
          type: modifySlotDialog.template.type,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          durationMinutes,
          capacity: modifiedData.capacity,
          priority: modifiedData.priority,
          desirabilityScore: modifySlotDialog.template.desirabilityScore || 3,
          requiredRoles: modifySlotDialog.template.requiredRoles || [],
        }),
      });

      if (res.ok) {
        toast.success(
          `Shift created from template "${modifySlotDialog.template.name}"`,
        );
        refetchShifts();
        window.dispatchEvent(
          new CustomEvent("shiftaware:cache-invalidate", {
            detail: { keys: ["shifts", "shifts*"] },
          }),
        );
        // Check for conflicts after creating shift
        const hasConflicts = await checkConflicts();
        if (hasConflicts) {
          toast.warning("Conflicts detected. Review and resolve.", 5000);
        }
        setModifySlotDialog({
          isOpen: false,
          template: null,
          targetDate: null,
          isLoading: false,
        });
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to create shift");
        setModifySlotDialog((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error("Failed to create shift:", error);
      toast.error("Failed to create shift. Please try again.");
      setModifySlotDialog((prev) => ({ ...prev, isLoading: false }));
    }
  }

  // shiftDay function removed - date navigation now handled in CalendarView

  const roleOptions = useMemo(() => {
    const roles = new Set<string>();
    shifts.forEach((shift) => {
      shift.requiredRoles?.forEach((r) => roles.add(r.role));
      shift.assignments?.forEach((a) => roles.add(a.role));
    });
    return Array.from(roles);
  }, [shifts]);

  const memberOptions = useMemo(() => {
    const members = new Map<string, string>();
    shifts.forEach((shift) => {
      shift.assignments?.forEach((a) =>
        members.set(a.teamMember.id, a.teamMember.alias),
      );
    });
    return Array.from(members.entries()).sort((a, b) =>
      a[1].localeCompare(b[1]),
    );
  }, [shifts]);

  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      // Filter by date in Day view
      if (viewType === "Day" && currentEventDate) {
        const shiftDate = shift.startTime.split("T")[0];
        if (shiftDate !== currentEventDate) return false;
      }

      // Filter by week in Week view
      if (viewType === "Week" && currentEventDate) {
        const shiftDate = new Date(shift.startTime);
        const weekStart = new Date(currentEventDate);
        const weekEnd = addDays(weekStart, 7);
        if (shiftDate < weekStart || shiftDate >= weekEnd) return false;
      }

      const state = coverageState(shift);
      if (coverageFilter !== "all" && state !== coverageFilter) return false;
      if (roleFilter !== "all") {
        const roleMatches =
          shift.requiredRoles?.some((r) => r.role === roleFilter) ||
          shift.assignments?.some((a) => a.role === roleFilter);
        if (!roleMatches) return false;
      }
      if (memberFilter !== "all") {
        const hasMember = shift.assignments?.some(
          (a) => a.teamMember.id === memberFilter,
        );
        if (!hasMember) return false;
      }
      return true;
    });
  }, [
    shifts,
    coverageFilter,
    roleFilter,
    memberFilter,
    viewType,
    currentEventDate,
  ]);

  const metrics = useMemo(() => {
    const totalCapacity = filteredShifts.reduce(
      (acc, shift) => acc + (shift.capacity || 0),
      0,
    );
    const filled = filteredShifts.reduce(
      (acc, shift) => acc + (shift.assignments?.length || 0),
      0,
    );
    const fullCount = filteredShifts.filter(
      (s) => coverageState(s) === "full",
    ).length;
    const partialCount = filteredShifts.filter(
      (s) => coverageState(s) === "partial",
    ).length;
    const emptyCount = filteredShifts.filter(
      (s) => coverageState(s) === "empty",
    ).length;
    const coverage =
      totalCapacity === 0 ? 0 : Math.round((filled / totalCapacity) * 100);
    return {
      totalCapacity,
      filled,
      coverage,
      fullCount,
      partialCount,
      emptyCount,
    };
  }, [filteredShifts]);

  function handleAssignmentClick(data: any) {
    const shift = filteredShifts.find((s) => s.id === data.id);
    setSelectedShift(shift || null);
  }

  async function handleDeleteShift(shiftId: string) {
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;

    setDeleteDialog({
      isOpen: true,
      shiftId,
      shiftName: `${shift.type.replace("_", " ")} - ${shift.event.name}`,
      isLoading: false,
    });
  }

  async function confirmDelete() {
    if (!deleteDialog.shiftId) return;

    setDeleteDialog((prev) => ({ ...prev, isLoading: true }));

    try {
      const res = await fetch(`/api/shifts/${deleteDialog.shiftId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Shift deleted successfully");
        // Invalidate cache
        window.dispatchEvent(
          new CustomEvent("shiftaware:cache-invalidate", {
            detail: {
              keys: ["shifts", "shifts*", "assignments", "assignments*"],
            },
          }),
        );
        setDeleteDialog({
          isOpen: false,
          shiftId: null,
          shiftName: "",
          isLoading: false,
        });
        // Close shift details if open
        if (selectedShift?.id === deleteDialog.shiftId) {
          setSelectedShift(null);
        }
      } else {
        const errorData = await res.json();
        const errorMessage = errorData.error || "Failed to delete shift";
        toast.error(errorMessage);
        setDeleteDialog((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error("Failed to delete shift:", error);
      toast.error("Failed to delete shift. Please try again.");
      setDeleteDialog((prev) => ({ ...prev, isLoading: false }));
    }
  }

  if (loading && shifts.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" variant="text" />
        <SkeletonList count={3} />
      </div>
    );
  }

  return (
    <>
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => {
          if (!deleteDialog.isLoading) {
            setDeleteDialog({
              isOpen: false,
              shiftId: null,
              shiftName: "",
              isLoading: false,
            });
          }
        }}
        onConfirm={confirmDelete}
        title="Delete Shift"
        message={`Are you sure you want to delete "${deleteDialog.shiftName}"? This action cannot be undone. If this shift has assignments, it cannot be deleted.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deleteDialog.isLoading}
      />

      <ModifySlotDialog
        isOpen={modifySlotDialog.isOpen}
        onClose={() =>
          setModifySlotDialog({
            isOpen: false,
            template: null,
            targetDate: null,
            isLoading: false,
          })
        }
        onConfirm={handleModifySlotConfirm}
        template={modifySlotDialog.template}
        targetDate={modifySlotDialog.targetDate}
        isLoading={modifySlotDialog.isLoading}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-8 relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                Shift Schedule
              </h1>
              <p className="text-gray-500 font-medium">
                Global view of all staff assignments
              </p>
            </div>
            <div className="flex items-center gap-2">
              {conflictCount !== null && conflictCount > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowConflictWizard(true)}
                  className="flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <span>
                    {conflictCount} Conflict{conflictCount !== 1 ? "s" : ""}
                  </span>
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowTemplatePalette(!showTemplatePalette)}
              >
                <Clock className="w-4 h-4" />
                Templates
              </Button>
              <div className="bg-white border border-gray-200 rounded-xl p-1 flex shadow-sm">
                {(["Day", "Week", "Grid"] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setViewType(option)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                      viewType === option
                        ? "bg-primary-500 text-white shadow-md"
                        : "text-gray-400 hover:text-gray-600",
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <Button
                onClick={() => refetchShifts()}
                variant="primary"
                className="shadow-lg shadow-primary-500/20"
              >
                <RefreshCw
                  className={cn("w-4 h-4", loading && "animate-spin")}
                />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-2xl shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest font-black text-white/80">
                    Coverage
                  </p>
                  <p className="text-3xl font-black mt-1">
                    {metrics.coverage}%
                  </p>
                  <p className="text-white/80 text-sm font-medium">
                    Filled {metrics.filled} / {metrics.totalCapacity}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-white/15">
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </Card>
            <Card className="p-4 rounded-2xl border border-success-100 bg-success-50">
              <p className="text-xs uppercase tracking-widest font-black text-success-700">
                Fully staffed
              </p>
              <p className="text-2xl font-black text-success-900 mt-1">
                {metrics.fullCount}
              </p>
              <p className="text-success-700 text-sm">Shifts at capacity</p>
            </Card>
            <Card className="p-4 rounded-2xl border border-accent-100 bg-accent-50">
              <p className="text-xs uppercase tracking-widest font-black text-accent-700">
                Partial
              </p>
              <p className="text-2xl font-black text-accent-900 mt-1">
                {metrics.partialCount}
              </p>
              <p className="text-accent-700 text-sm">Need more coverage</p>
            </Card>
            <Card className="p-4 rounded-2xl border border-red-100 bg-red-50">
              <p className="text-xs uppercase tracking-widest font-black text-red-700">
                Unstaffed
              </p>
              <p className="text-2xl font-black text-red-900 mt-1">
                {metrics.emptyCount}
              </p>
              <p className="text-red-700 text-sm">Urgent attention</p>
            </Card>
          </div>

          <Card className="p-4 bg-white border border-gray-200 shadow-sm rounded-2xl">
            <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-gray-700">
              <SlidersHorizontal className="w-4 h-4 text-primary-500" />
              Filters
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-500">
                  Coverage
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(["all", "full", "partial", "empty"] as const).map(
                    (option) => (
                      <button
                        key={option}
                        onClick={() => setCoverageFilter(option)}
                        className={cn(
                          "px-3 py-2 text-xs font-bold rounded-xl border transition-colors",
                          coverageFilter === option
                            ? "border-primary-500 bg-primary-50 text-primary-700"
                            : "border-gray-200 text-gray-600 hover:border-primary-200 hover:text-primary-700",
                        )}
                      >
                        {option === "all"
                          ? "All"
                          : coverageLegend[option].label}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-500">
                  Role
                </label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 bg-white focus:border-primary-400 focus:outline-none"
                >
                  <option value="all">All roles</option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-500">
                  Member
                </label>
                <select
                  value={memberFilter}
                  onChange={(e) => setMemberFilter(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 bg-white focus:border-primary-400 focus:outline-none"
                >
                  <option value="all">All members</option>
                  {memberOptions.map(([id, alias]) => (
                    <option key={id} value={id}>
                      {alias}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {(Object.keys(coverageLegend) as CoverageState[]).map((state) => (
              <div
                key={state}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-2xl border",
                  coverageLegend[state].bg,
                  coverageLegend[state].text,
                  state === "full"
                    ? "border-success-100"
                    : state === "partial"
                      ? "border-accent-100"
                      : "border-red-100",
                )}
              >
                <div
                  className={cn(
                    "w-2 h-2 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]",
                    coverageLegend[state].badge,
                  )}
                ></div>
                <span className="text-xs font-bold uppercase tracking-widest">
                  {coverageLegend[state].label}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-4">
            {showTemplatePalette && (
              <div className="w-64 flex-shrink-0">
                <TemplatePalette />
              </div>
            )}
            <Card className="p-0 shadow-xl overflow-hidden h-[calc(100vh-340px)] min-h-[600px] flex flex-col bg-white flex-1">
              <CalendarView
                shifts={filteredShifts}
                viewType={viewType}
                startDate={currentEventDate}
                showAssignments={true}
                onAssignmentClick={handleAssignmentClick}
                onDateChange={(date) => {
                  setCurrentEventDate(date);
                  // Also update view if needed
                  if (viewType === "Week") {
                    // Week view navigation updates the startDate which is the week start
                    setCurrentEventDate(date);
                  }
                }}
                eventRange={eventRange || undefined}
                onShiftDelete={handleDeleteShift}
              />
            </Card>
          </div>

          <DragOverlay>
            {activeTemplate && (
              <Card className="p-3 w-48">
                <div className="font-medium text-sm">{activeTemplate.name}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {activeTemplate.startTime}
                </div>
              </Card>
            )}
            {activeShiftDrag && (
              <Card className="p-3 w-56">
                <div className="text-xs text-gray-500 mb-1">Reschedule</div>
                <div className="font-medium text-sm">
                  {activeShiftDrag.type.replace("_", " ")}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {format(new Date(activeShiftDrag.startTime), "MMM d, HH:mm")}
                </div>
              </Card>
            )}
          </DragOverlay>

          {/* Dynamic coordinate tooltip */}
          {dragOverInfo && (activeTemplate || activeShiftDrag) && (
            <div
              className="fixed z-[9999] pointer-events-none"
              style={{
                left: `${dragOverInfo.x + 10}px`,
                top: `${dragOverInfo.y - 10}px`,
              }}
            >
              <div className="bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">
                {dragOverInfo.date &&
                  format(parseISO(dragOverInfo.date), "MMM d, yyyy")}
              </div>
            </div>
          )}

          {selectedShift && (
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <Card className="max-w-xl w-full bg-white border-none shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-primary-600 p-8 text-white relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                  <div className="relative">
                    <div className="flex items-start justify-between mb-4">
                      <span className="px-3 py-1 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-widest">
                        Shift Details
                      </span>
                      <button
                        onClick={() => setSelectedShift(null)}
                        className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 rotate-90" />
                      </button>
                    </div>
                    <h2 className="text-3xl font-black leading-tight mb-2">
                      {selectedShift.type.replace("_", " ")}
                    </h2>
                    <div className="flex items-center gap-4 text-primary-100 text-sm font-medium">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {format(
                          new Date(selectedShift.startTime),
                          "EEEE, MMM d",
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        {format(
                          new Date(selectedShift.startTime),
                          "HH:mm",
                        )} - {format(new Date(selectedShift.endTime), "HH:mm")}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-8">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Users className="w-3.5 h-3.5" />
                        Assignments ({selectedShift.assignments?.length ||
                          0} / {selectedShift.capacity})
                      </h3>
                    </div>
                    <div className="grid gap-3">
                      {selectedShift.assignments?.length > 0 ? (
                        selectedShift.assignments.map((a) => (
                          <div
                            key={a.id}
                            className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between group hover:border-primary-200 transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-2xl border border-gray-50 group-hover:scale-110 transition-transform">
                                {a.teamMember.avatarId}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 leading-none mb-1">
                                  {a.teamMember.alias}
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-primary-600">
                                    {a.role}
                                  </span>
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                                    • {a.assignmentType}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {a.algorithmScore &&
                              a.algorithmScore.overall !== undefined && (
                                <div className="text-right">
                                  <div className="px-3 py-1 rounded-lg bg-success-50 border border-success-100">
                                    <span className="text-success-700 text-xs font-black">
                                      {(a.algorithmScore.overall * 100).toFixed(
                                        0,
                                      )}{" "}
                                      pts
                                    </span>
                                  </div>
                                </div>
                              )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                          <User className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                          <p className="text-gray-400 text-sm font-medium">
                            No members assigned yet.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedShift.assignments?.some((a) => a.notes) && (
                    <div className="animate-in slide-in-from-top-2">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Algorithm Rationale
                      </h3>
                      <div className="grid gap-2">
                        {selectedShift.assignments
                          .filter((a) => a.notes)
                          .map((a) => (
                            <div
                              key={`note-${a.id}`}
                              className="text-xs font-medium text-gray-600 bg-primary-50/50 p-4 rounded-2xl border border-primary-100 flex gap-3"
                            >
                              <span className="text-primary-600 font-black shrink-0">
                                {a.teamMember.alias}:
                              </span>
                              {a.notes}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-8 pb-8 flex justify-end gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedShift(null)}
                    className="bg-gray-100 text-gray-600 border-none hover:bg-gray-200 px-8 py-3 rounded-2xl font-bold uppercase tracking-widest text-xs"
                  >
                    Dismiss
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      if (selectedShift) {
                        setEditedStartTime(selectedShift.startTime);
                        setEditedEndTime(selectedShift.endTime);
                        setShowTimeEditor(true);
                      }
                    }}
                    className="shadow-lg shadow-primary-500/20 px-8 py-3 rounded-2xl font-bold uppercase tracking-widest text-xs"
                  >
                    Modify Slot
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* Time Editor Modal */}
          {showTimeEditor && selectedShift && (
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[101] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <Card className="max-w-md w-full bg-white border-none shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8 space-y-6">
                  <div>
                    <h3 className="text-2xl font-black text-gray-900 mb-2">
                      Modify Shift Time
                    </h3>
                    <p className="text-sm text-gray-600">
                      Update the start and end times for this shift
                    </p>
                  </div>

                  <div className="space-y-4">
                    <DateTimePicker
                      label="Start Time"
                      value={editedStartTime}
                      onChange={(value) => setEditedStartTime(value)}
                      use24Hour={true}
                      required
                    />
                    <DateTimePicker
                      label="End Time"
                      value={editedEndTime}
                      onChange={(value) => setEditedEndTime(value)}
                      use24Hour={true}
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowTimeEditor(false);
                        setEditedStartTime("");
                        setEditedEndTime("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={async () => {
                        try {
                          const res = await fetch(
                            `/api/shifts/${selectedShift.id}`,
                            {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                startTime: editedStartTime,
                                endTime: editedEndTime,
                              }),
                            },
                          );

                          if (res.ok) {
                            toast.success("Shift time updated");
                            refetchShifts();
                            window.dispatchEvent(
                              new CustomEvent("shiftaware:cache-invalidate", {
                                detail: { keys: ["shifts", "shifts*"] },
                              }),
                            );
                            setShowTimeEditor(false);
                            setSelectedShift(null);
                            const hasConflicts = await checkConflicts();
                            if (hasConflicts) {
                              toast.warning(
                                "Conflicts detected. Review and resolve.",
                                5000,
                              );
                            }
                          } else {
                            const errorData = await res.json();
                            toast.error(
                              errorData.error || "Failed to update shift time",
                            );
                          }
                        } catch (error) {
                          console.error("Failed to update shift time:", error);
                          toast.error(
                            "Failed to update shift time. Please try again.",
                          );
                        }
                      }}
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </DndContext>

      {/* Conflict Wizard */}
      <ConflictWizard
        isOpen={showConflictWizard}
        onClose={() => {
          setShowConflictWizard(false);
          checkConflicts(); // Refresh conflict count after wizard closes
        }}
      />
    </>
  );
}
