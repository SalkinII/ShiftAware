"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";
import {
  Plus,
  Clock,
  Calendar,
  Shield,
  Tag,
  ChevronRight,
  Filter,
  List,
  Zap,
  GripVertical,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ShiftCardActions } from "@/components/ui/ShiftCardActions";
import { TemplatePalette } from "@/components/features/TemplatePalette/TemplatePalette";
import { useCache } from "@/lib/cache/useCache";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useEventContext } from "@/lib/hooks/useEventContext";
import { unwrapApiResponse } from "@/lib/api-errors";
import { calculateSnapPosition, findShiftEndTimes } from "@/lib/utils/snap";
import { isValidLaneDrop } from "@/lib/utils/lane-validation";
import { ShiftType, ShiftPriority, Role } from "@prisma/client";
import { format, addMinutes, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import CalendarView from "@/components/features/Calendar/CalendarView";
import { LaneCalendarView } from "@/components/features/LaneCalendar";
import html2canvas from "html2canvas";

interface Shift {
  id: string;
  type: ShiftType;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  priority: ShiftPriority;
  desirabilityScore: number;
  capacity: number;
  eventId: string;
  event: { id: string; name: string };
  requiredRoles: { role: Role; count: number }[];
}

interface Event {
  id: string;
  name: string;
}

interface DraggedTemplate {
  id: string;
  name: string;
  type: ShiftType;
  durationMinutes: number;
  startTime: string;
}

export default function ShiftsPage() {
  const toast = useToast();
  const calendarRef = useRef<HTMLDivElement>(null);
  const { selectedEventId, selectedEvent } = useEventContext(true);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [showForm, setShowForm] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [activeTemplate, setActiveTemplate] = useState<DraggedTemplate | null>(
    null,
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
  const [formData, setFormData] = useState({
    eventId: "",
    type: "MOBILE_TEAM" as ShiftType,
    startTime: "",
    endTime: "",
    durationMinutes: 360,
    priority: "CORE" as ShiftPriority,
    desirabilityScore: 3,
    capacity: 2,
    requiredRoles: [{ role: "TEAM_MEMBER", count: 1 }],
  });

  // Sync formData.eventId with header event selection
  useEffect(() => {
    if (selectedEventId) {
      setFormData((prev) => ({ ...prev, eventId: selectedEventId }));
    }
  }, [selectedEventId]);

  // Use cache for shifts
  const {
    data: cachedShifts,
    loading: shiftsLoading,
    error: shiftsError,
    refetch: refetchShifts,
  } = useCache<Shift[]>({
    key: selectedEventId ? `shifts-${selectedEventId}` : "shifts-none",
    fetchFn: async () => {
      if (!selectedEventId) return [];
      const res = await fetch(`/api/shifts?eventId=${selectedEventId}`);
      if (!res.ok) {
        let errorMessage = "Failed to fetch shifts";
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = `${errorMessage}: ${res.status} ${res.statusText}`;
        }
        throw new Error(errorMessage);
      }
      const json = await res.json();
      return unwrapApiResponse<Shift[]>(json);
    },
    enabled: !!selectedEventId,
  });

  // Defensive: ensure shifts is always an array
  const allShifts = Array.isArray(cachedShifts) ? cachedShifts : [];

  const shifts = allShifts || [];

  // Calculate event range for calendar view
  const eventRange = useMemo(() => {
    if (shifts.length === 0) return undefined;
    const dates = shifts.map((s) => s.startTime.split("T")[0]).sort();
    return { start: dates[0], end: dates[dates.length - 1] };
  }, [shifts]);

  const loading = shiftsLoading;

  // Show error toast if fetch fails
  useEffect(() => {
    if (shiftsError) {
      toast.error(shiftsError.message || "Failed to load shifts");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftsError]);

  // Listen for cache invalidation events
  useEffect(() => {
    function handleCacheInvalidate(e: CustomEvent) {
      const keys = e.detail?.keys as string[] | undefined;
      if (keys && keys.some((k) => k === "shifts" || k.startsWith("shifts*"))) {
        refetchShifts();
      }
    }

    window.addEventListener(
      "shiftaware:cache-invalidate",
      handleCacheInvalidate as EventListener,
    );
    return () => {
      window.removeEventListener(
        "shiftaware:cache-invalidate",
        handleCacheInvalidate as EventListener,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DnD sensors for template drag-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  // Track active dragged template for DragOverlay
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const activeData = active.data.current;

    if (activeData?.type === "template") {
      setActiveTemplate(activeData.template);
    }
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveTemplate(null);
  }, []);

  // Handle template drop onto calendar with snap
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveTemplate(null);

      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current;
      const overData = over.data.current;

      // Handle shift repositioning
      if (activeData?.type === "shift") {
        const shift = activeData.shift;
        // TODO: Calculate new position from drop coordinates and update via API
        // This will be implemented when integrating with the actual calendar grid
        console.log("Shift drag detected:", shift);
        return;
      }

      // Handle lane drops (new)
      if (activeData?.type === "template" && overData?.type === "lane") {
        const template = activeData.template;
        const {
          date: dropDate,
          laneType,
          dayStart,
          dayEnd,
          snapTargets,
        } = overData;

        // Validate drop - silent rejection if invalid
        const targetLane = laneType as ShiftType;
        if (!isValidLaneDrop(template, targetLane)) {
          return; // Silent rejection - no toast, no shift created
        }

        const targetEventId = selectedEventId;
        if (!targetEventId) {
          toast.error("Please select an event first");
          return;
        }

        // Get pointer position for time calculation
        const overNode = document.querySelector(
          `[data-testid="lane-drop-${dropDate}-${laneType}"]`,
        );
        if (!overNode) return;

        const rect = overNode.getBoundingClientRect();
        const dropX = event.delta?.x
          ? rect.left + rect.width / 2 + event.delta.x
          : rect.left + rect.width / 2;
        const relativeX = (dropX - rect.left) / rect.width;

        // Calculate time from position
        const {
          calculateTimeFromPosition,
          roundToInterval,
          calculateSnapPosition,
        } = await import("@/lib/utils/snap");
        const rawTime = calculateTimeFromPosition(
          relativeX,
          new Date(dayStart),
          new Date(dayEnd),
        );
        const roundedTime = roundToInterval(rawTime, 15);
        const { snapped, time: startTime } = calculateSnapPosition(
          roundedTime,
          snapTargets,
          30,
        );

        const endTime = addMinutes(startTime, template.durationMinutes);

        if (snapped) {
          toast.info(`Snapped to ${format(startTime, "HH:mm")}`);
        }

        try {
          const payload = {
            eventId: targetEventId,
            type: laneType,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            durationMinutes: template.durationMinutes,
            priority: template.priority,
            desirabilityScore: 3,
            capacity: template.capacity,
            requiredRoles: [{ role: "TEAM_MEMBER", count: template.capacity }],
          };

          const res = await fetch("/api/shifts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            toast.success(
              `Created ${laneType.replace(/_/g, " ")} shift at ${format(startTime, "HH:mm")}`,
            );
            window.dispatchEvent(
              new CustomEvent("shiftaware:cache-invalidate", {
                detail: { keys: ["shifts", "shifts*"] },
              }),
            );
          } else {
            const errorData = await res.json();
            toast.error(errorData.error || "Failed to create shift");
          }
        } catch (error) {
          console.error("Failed to create shift:", error);
          toast.error("Failed to create shift");
        }
        return;
      }

      // Keep legacy date drop handling for backwards compatibility
      if (activeData?.type === "template" && overData?.type === "date") {
        const template = activeData.template;
        const dropDate = overData.date;

        const targetEventId = selectedEventId;
        if (!targetEventId) {
          toast.error("Please select an event first");
          return;
        }

        const [hours, minutes] = template.startTime.split(":").map(Number);
        const baseDropTime = new Date(`${dropDate}T${template.startTime}:00`);

        const shiftEndTimes = findShiftEndTimes(
          shifts.filter((s) => s.startTime.split("T")[0] === dropDate),
          template.type,
        );

        const { snapped, time: startTime } = calculateSnapPosition(
          baseDropTime,
          shiftEndTimes,
          30,
        );

        const endTime = addMinutes(startTime, template.durationMinutes);

        if (snapped) {
          toast.info(
            `Snapped to end of previous ${template.type.replace("_", " ")} shift`,
          );
        }

        try {
          const payload = {
            eventId: targetEventId,
            type: template.type,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            durationMinutes: template.durationMinutes,
            priority: template.priority,
            desirabilityScore: 3,
            capacity: template.capacity,
            requiredRoles: [{ role: "TEAM_MEMBER", count: template.capacity }],
          };

          const res = await fetch("/api/shifts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            toast.success(
              `Created ${template.type.replace("_", " ")} shift at ${format(startTime, "HH:mm")}`,
            );
            window.dispatchEvent(
              new CustomEvent("shiftaware:cache-invalidate", {
                detail: { keys: ["shifts", "shifts*"] },
              }),
            );
          } else {
            const errorData = await res.json();
            toast.error(errorData.error || "Failed to create shift");
          }
        } catch (error) {
          console.error("Failed to create shift from template:", error);
          toast.error("Failed to create shift");
        }
      }
    },
    [selectedEventId, shifts, toast],
  );

  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!formData.eventId) {
      errors.eventId = "Please select an event";
    }

    if (!formData.startTime) {
      errors.startTime = "Start time is required";
    }

    if (!formData.endTime) {
      errors.endTime = "End time is required";
    }

    if (formData.startTime && formData.endTime) {
      const startDate = new Date(formData.startTime);
      const endDate = new Date(formData.endTime);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        errors.startTime = "Invalid date format";
      } else {
        const calculatedDuration = Math.round(
          (endDate.getTime() - startDate.getTime()) / 60000,
        );
        if (calculatedDuration <= 0) {
          errors.endTime = "End time must be after start time";
        }
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedEventId) {
      toast.error("Please select an event from the header first");
      return;
    }

    if (!validateForm()) {
      toast.error("Please fix the form errors before submitting");
      return;
    }

    // Convert datetime-local format to ISO datetime strings
    const startDate = new Date(formData.startTime);
    const endDate = new Date(formData.endTime);

    // Calculate duration from actual times to ensure it matches
    const calculatedDuration = Math.round(
      (endDate.getTime() - startDate.getTime()) / 60000,
    );

    // Prepare payload with ISO datetime strings and matching duration
    const payload = {
      ...formData,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      durationMinutes: calculatedDuration, // Use calculated duration to match validation
    };

    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Shift created successfully");
        setShowForm(false);
        setFormErrors({});
        // Notify schedule page to refresh
        window.dispatchEvent(new CustomEvent("shiftaware:refresh-schedule"));
        // Invalidate cache
        window.dispatchEvent(
          new CustomEvent("shiftaware:cache-invalidate", {
            detail: {
              keys: ["shifts", "shifts*", "assignments", "assignments*"],
            },
          }),
        );
        // Reset form
        setFormData({
          eventId: selectedEventId || "",
          type: "MOBILE_TEAM" as ShiftType,
          startTime: "",
          endTime: "",
          durationMinutes: 360,
          priority: "CORE" as ShiftPriority,
          desirabilityScore: 3,
          capacity: 2,
          requiredRoles: [{ role: "TEAM_MEMBER", count: 1 }],
        });
      } else {
        const errorData = await res.json();
        let errorMessage = errorData.error || "Failed to create shift";

        // Parse Zod validation errors
        if (errorData.details && Array.isArray(errorData.details)) {
          const issues = errorData.details
            .map((issue: { path?: string | string[]; message?: string }) => {
              const path = Array.isArray(issue.path)
                ? issue.path.join(".")
                : issue.path || "unknown";
              // Map common field names to user-friendly labels
              const fieldMap: Record<string, string> = {
                eventId: "Event",
                startTime: "Start Time",
                endTime: "End Time",
                durationMinutes: "Duration",
                type: "Shift Type",
                priority: "Priority",
                capacity: "Capacity",
                requiredRoles: "Required Roles",
              };
              const friendlyPath = fieldMap[path] || path;
              return `${friendlyPath}: ${issue.message || "Invalid value"}`;
            })
            .join(", ");
          errorMessage = `Validation error: ${issues}`;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }

        toast.error(errorMessage);
      }
    } catch (error) {
      console.error("Failed to create shift:", error);
      toast.error("Failed to create shift. Please try again.");
    }
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

  async function handleUpdateShift(
    shiftId: string,
    updates: { startTime?: Date; endTime?: Date; capacity?: number },
  ) {
    try {
      const payload: any = {};
      if (updates.startTime)
        payload.startTime = updates.startTime.toISOString();
      if (updates.endTime) payload.endTime = updates.endTime.toISOString();
      if (updates.capacity !== undefined) payload.capacity = updates.capacity;

      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Shift updated successfully");
        window.dispatchEvent(
          new CustomEvent("shiftaware:cache-invalidate", {
            detail: { keys: ["shifts", "shifts*"] },
          }),
        );
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to update shift");
      }
    } catch (error) {
      console.error("Failed to update shift:", error);
      toast.error("Failed to update shift");
    }
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

  async function handleExportCalendar() {
    if (!calendarRef.current) return;

    try {
      const canvas = await html2canvas(calendarRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });

      const link = document.createElement("a");
      link.download = `shift-schedule-${format(new Date(), "yyyy-MM-dd")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast.success("Schedule exported successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export schedule");
    }
  }

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "Escape",
      handler: () => {
        if (showForm) {
          setShowForm(false);
          setFormErrors({});
        }
        if (deleteDialog.isOpen && !deleteDialog.isLoading) {
          setDeleteDialog({
            isOpen: false,
            shiftId: null,
            shiftName: "",
            isLoading: false,
          });
        }
      },
    },
  ]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" variant="text" />
        <SkeletonList count={5} />
      </div>
    );
  }

  const getPriorityColor = (p: ShiftPriority) => {
    return p === "CORE"
      ? "bg-primary-100 text-primary-700"
      : "bg-gray-100 text-gray-600";
  };

  const getShiftTypeColor = (type: ShiftType) => {
    switch (type) {
      case "MOBILE_TEAM":
        return "bg-blue-500";
      case "STATIONARY":
        return "bg-success-500";
      case "SUPER":
        return "bg-accent-500";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Drag overlay for templates */}
      <DragOverlay>
        {activeTemplate ? (
          <div className="bg-white rounded-xl shadow-2xl p-4 border-2 border-primary-500 min-w-[200px] opacity-90">
            <div className="font-bold text-gray-900">{activeTemplate.name}</div>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span>
                {activeTemplate.startTime} (
                {Math.round(activeTemplate.durationMinutes / 60)}h)
              </span>
            </div>
            <div className="text-xs text-primary-500 mt-1">
              {activeTemplate.type.replace("_", " ")}
            </div>
          </div>
        ) : null}
      </DragOverlay>
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
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Shift Configuration
            </h1>
            <p className="text-gray-500 font-medium">
              Define and manage event shift requirements
            </p>
          </div>
          <div className="flex gap-2">
            {viewMode === "calendar" && (
              <Button
                variant="secondary"
                onClick={handleExportCalendar}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Export
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => toast.success("Shifts published to team members")}
              className="flex items-center gap-2"
            >
              <Zap className="w-4 h-4" /> Publish Shifts
            </Button>
            <Button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 shadow-lg shadow-primary-500/20"
            >
              {showForm ? (
                "Cancel"
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Define New Shift
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                  Filter by Event
                </span>
              </div>
              <div className="flex items-center gap-3">
                {!selectedEventId && (
                  <span className="text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
                    Select an event from the header
                  </span>
                )}
                {selectedEvent && (
                  <span className="text-sm font-bold text-gray-700 px-4 py-2">
                    {selectedEvent.name}
                  </span>
                )}
                <div className="flex rounded-lg overflow-hidden border border-gray-200">
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "p-2 transition-colors",
                      viewMode === "list"
                        ? "bg-primary-500 text-white"
                        : "bg-white text-gray-400 hover:text-gray-600",
                    )}
                    title="List view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("calendar")}
                    className={cn(
                      "p-2 transition-colors",
                      viewMode === "calendar"
                        ? "bg-primary-500 text-white"
                        : "bg-white text-gray-400 hover:text-gray-600",
                    )}
                    title="Calendar view"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>

            {viewMode === "calendar" ? (
              <div
                ref={calendarRef}
                className="bg-white rounded-xl shadow-sm overflow-hidden"
              >
                {shifts.length === 0 ? (
                  <div className="p-12 text-center text-gray-400">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No shifts to display</p>
                    <p className="text-sm">
                      Create shifts using the form or drag templates from the
                      sidebar
                    </p>
                  </div>
                ) : (
                  <LaneCalendarView
                    shifts={shifts}
                    startDate={
                      eventRange ? new Date(eventRange.start) : new Date()
                    }
                    endDate={eventRange ? new Date(eventRange.end) : new Date()}
                    activeTemplate={activeTemplate}
                    isEditable={true}
                    onShiftUpdate={handleUpdateShift}
                    onShiftDelete={handleDeleteShift}
                  />
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {shifts.map((shift) => (
                  <Card
                    key={shift.id}
                    className="shadow-sm hover:shadow-md transition-all overflow-hidden p-0"
                  >
                    <div className="flex flex-col md:flex-row">
                      <div
                        className={cn(
                          "w-2 md:w-3 shrink-0",
                          getShiftTypeColor(shift.type),
                        )}
                      />
                      <div className="flex-1 p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-lg font-bold text-gray-900">
                                {shift.type.replace("_", " ")}
                              </h3>
                              <span
                                className={cn(
                                  "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                                  getPriorityColor(shift.priority),
                                )}
                              >
                                {shift.priority}
                              </span>
                            </div>
                            <p className="text-sm text-gray-400 font-bold uppercase tracking-tighter flex items-center gap-1.5">
                              <Tag className="w-3.5 h-3.5" /> {shift.event.name}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-xl font-black text-gray-900 leading-none">
                                {shift.capacity}
                              </p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                Capacity
                              </p>
                            </div>
                            <ShiftCardActions
                              shiftId={shift.id}
                              onDelete={() => handleDeleteShift(shift.id)}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-50">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                              <Clock className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">
                                Timing
                              </p>
                              <p className="text-sm font-bold text-gray-700 leading-none">
                                {shift.startTime && shift.endTime
                                  ? `${format(new Date(shift.startTime), "HH:mm")} - ${format(new Date(shift.endTime), "HH:mm")}`
                                  : "TBD"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">
                                Date
                              </p>
                              <p className="text-sm font-bold text-gray-700 leading-none">
                                {shift.startTime
                                  ? format(
                                      new Date(shift.startTime),
                                      "MMM do, yyyy",
                                    )
                                  : "TBD"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                              <Shield className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">
                                Score
                              </p>
                              <div className="flex gap-0.5 text-accent-500">
                                {[...Array(5)].map((_, i) => (
                                  <span
                                    key={i}
                                    className={cn(
                                      "text-xs",
                                      i >= shift.desirabilityScore &&
                                        "text-gray-200",
                                    )}
                                  >
                                    ★
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button className="bg-gray-50 p-4 flex items-center justify-center text-gray-300 hover:text-primary-500 hover:bg-primary-50 transition-all border-l border-gray-100">
                        <ChevronRight className="w-6 h-6" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {showForm ? (
              <Card className="bg-white border-none shadow-xl p-8 animate-in slide-in-from-right-4 duration-300">
                <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary-500" /> New Shift
                </h2>
                <form
                  onSubmit={handleSubmit}
                  className="space-y-5"
                  aria-label="Create new shift form"
                >
                  {selectedEvent ? (
                    <div className="text-sm font-medium text-gray-700 bg-gray-50 px-4 py-3 rounded-lg">
                      Event:{" "}
                      <span className="font-bold">{selectedEvent.name}</span>
                    </div>
                  ) : (
                    <div className="text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-lg">
                      Select an event from the header first
                    </div>
                  )}

                  <Select
                    label="Shift Type"
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: e.target.value as ShiftType,
                      })
                    }
                    className="bg-gray-50 border-gray-100 font-medium"
                  >
                    <option value="MOBILE_TEAM">Mobile Team</option>
                    <option value="STATIONARY">Stationary</option>
                    <option value="SUPER">SUPER</option>
                  </Select>

                  <div className="grid grid-cols-1 gap-4">
                    <DateTimePicker
                      label="Start Date & Time"
                      value={formData.startTime}
                      onChange={(value) => {
                        if (formErrors.startTime) {
                          setFormErrors({ ...formErrors, startTime: "" });
                        }
                        if (!value) {
                          setFormData({
                            ...formData,
                            startTime: "",
                            endTime: "",
                          });
                          return;
                        }
                        const start = new Date(value);
                        if (isNaN(start.getTime())) {
                          return;
                        }
                        const duration = formData.durationMinutes || 360;
                        const end = new Date(
                          start.getTime() + duration * 60000,
                        );
                        if (isNaN(end.getTime())) {
                          return;
                        }
                        setFormData({
                          ...formData,
                          startTime: value,
                          endTime: end.toISOString().slice(0, 16),
                        });
                      }}
                      error={formErrors.startTime}
                      required
                      use24Hour={true}
                    />
                    <DateTimePicker
                      label="End Date & Time"
                      value={formData.endTime}
                      onChange={(value) => {
                        if (formErrors.endTime) {
                          setFormErrors({ ...formErrors, endTime: "" });
                        }
                        if (!value) {
                          setFormData({
                            ...formData,
                            endTime: "",
                          });
                          return;
                        }
                        if (!formData.startTime) {
                          setFormData({
                            ...formData,
                            endTime: value,
                          });
                          return;
                        }
                        const start = new Date(formData.startTime);
                        const end = new Date(value);
                        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                          setFormData({
                            ...formData,
                            endTime: value,
                          });
                          return;
                        }
                        const minutes = Math.round(
                          (end.getTime() - start.getTime()) / 60000,
                        );
                        if (isNaN(minutes) || minutes < 0) {
                          setFormData({
                            ...formData,
                            endTime: value,
                          });
                          return;
                        }
                        setFormData({
                          ...formData,
                          endTime: value,
                          durationMinutes: minutes,
                        });
                      }}
                      error={formErrors.endTime}
                      required
                      use24Hour={true}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label="Priority"
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          priority: e.target.value as ShiftPriority,
                        })
                      }
                      className="bg-gray-50 border-gray-100 font-medium"
                    >
                      <option value="CORE">Core</option>
                      <option value="BUFFER">Buffer</option>
                    </Select>
                    <Input
                      label="Score (1-5)"
                      type="number"
                      min="1"
                      max="5"
                      value={
                        isNaN(formData.desirabilityScore)
                          ? ""
                          : formData.desirabilityScore
                      }
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value) && value >= 1 && value <= 5) {
                          setFormData({
                            ...formData,
                            desirabilityScore: value,
                          });
                        }
                      }}
                      required
                      className="bg-gray-50 border-gray-100 font-medium"
                    />
                  </div>

                  <Input
                    label="Staff Capacity"
                    type="number"
                    min="1"
                    value={isNaN(formData.capacity) ? "" : formData.capacity}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value >= 1) {
                        setFormData({
                          ...formData,
                          capacity: value,
                        });
                      }
                    }}
                    required
                    className="bg-gray-50 border-gray-100 font-medium"
                  />

                  <Button
                    type="submit"
                    className="w-full py-4 shadow-lg shadow-primary-500/20 font-bold uppercase tracking-widest text-xs mt-4"
                  >
                    Register Shift Template
                  </Button>
                </form>
              </Card>
            ) : viewMode === "calendar" ? (
              <div className="space-y-6">
                <Card className="bg-gradient-to-br from-primary-600 to-primary-700 text-white p-6 border-none shadow-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <Zap className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase tracking-widest opacity-80">
                      Drag & Drop
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed opacity-90">
                    Drag templates onto the calendar to create shifts.
                    They&apos;ll snap to the end of existing shifts for seamless
                    succession.
                  </p>
                </Card>
                <TemplatePalette />
                <Card className="bg-white border-none shadow-sm p-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    Shift Count
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="text-gray-600">M1:</span>
                      <span className="font-bold">
                        {shifts.filter((s) => s.type === "MOBILE_TEAM").length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-success-500"></div>
                      <span className="text-gray-600">ST:</span>
                      <span className="font-bold">
                        {shifts.filter((s) => s.type === "STATIONARY").length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-accent-500"></div>
                      <span className="text-gray-600">EX:</span>
                      <span className="font-bold">
                        {shifts.filter((s) => s.type === "SUPER").length}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            ) : (
              <div className="space-y-6">
                <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white p-8 border-none shadow-xl">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-6">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-black mb-2 leading-tight">
                    Configurable Slots
                  </h3>
                  <p className="text-sm text-primary-100 leading-relaxed opacity-90">
                    Each shift defines its type, required capacity, and
                    desirability. The algorithm uses the score to prioritize
                    popular or difficult slots.
                  </p>
                </Card>

                <Card className="bg-white border-none shadow-sm p-6">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                    Slot Breakdown
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>{" "}
                        Mobile
                      </span>
                      <span className="text-sm font-black text-gray-900">
                        {shifts.filter((s) => s.type === "MOBILE_TEAM").length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-success-500"></div>{" "}
                        Stationary
                      </span>
                      <span className="text-sm font-black text-gray-900">
                        {shifts.filter((s) => s.type === "STATIONARY").length}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </DndContext>
  );
}
