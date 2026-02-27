"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
  Lock,
  CheckCircle,
  Archive,
  Users,
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
import { canMutateShifts } from "@/lib/services/event-status-permissions";
import {
  getNextStatus,
  getPreviousStatus,
} from "@/lib/validations/event-transition";
import { getShiftsCacheKey } from "@/lib/cache/utils";
import { invalidateEventCache } from "@/lib/cache/invalidateEventCache";
import { unwrapApiResponse } from "@/lib/api-errors";
import { deriveLanesFromTemplates } from "@/lib/types/lane";
import { ShiftType, ShiftPriority, Role } from "@prisma/client";
import { format, addMinutes, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  LaneCalendarCanvas,
  type LaneCalendarCanvasHandle,
} from "@/components/features/LaneCalendar/LaneCalendarCanvas";
import { ShiftPropertiesPanel } from "@/components/features/LaneCalendar/sidebar/ShiftPropertiesPanel";

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
  assignments?: Array<{ id: string; teamMember?: { alias: string } }>;
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
  const canvasRef = useRef<LaneCalendarCanvasHandle>(null);
  const { selectedEventId, selectedEvent, refreshEvents } =
    useEventContext(true);
  const shiftMutationLocked = selectedEvent
    ? !canMutateShifts(
        selectedEvent.status as import("@prisma/client").EventStatus,
      )
    : false;

  const STATUS_ACTION_LABELS: Record<
    string,
    { label: string; icon: typeof Zap }
  > = {
    OPEN_FOR_PREFERENCES: { label: "Publish Shifts", icon: Zap },
    ASSIGNING: { label: "Close Preferences", icon: Lock },
    FINALIZED: { label: "Finalize Schedule", icon: CheckCircle },
    COMPLETED: { label: "Mark Complete", icon: Archive },
  };

  const handleTransition = async (targetStatus: string) => {
    if (!selectedEventId) return;
    const label = STATUS_ACTION_LABELS[targetStatus]?.label || targetStatus;
    if (
      !confirm(
        `Are you sure you want to ${label.toLowerCase()}? This will change the event workflow state.`,
      )
    )
      return;

    const res = await fetch(`/api/events/${selectedEventId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetStatus }),
    });

    if (res.ok) {
      toast.success(
        `Event status changed to ${targetStatus.replace(/_/g, " ").toLowerCase()}`,
      );
      refreshEvents();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error || json.message || "Failed to change status");
    }
  };

  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [showForm, setShowForm] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
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
    key: selectedEventId ? getShiftsCacheKey(selectedEventId) : "shifts-none",
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

  // Fetch templates for the selected event to derive lanes
  const { data: eventTemplates } = useCache<any[]>({
    key: selectedEventId
      ? `event-templates-${selectedEventId}`
      : "event-templates-none",
    fetchFn: async () => {
      if (!selectedEventId) return [];
      const res = await fetch(`/api/events/${selectedEventId}/templates`);
      if (!res.ok) return [];
      const json = await res.json();
      const result = unwrapApiResponse<{
        assigned: any[];
        eventSpecific?: any[];
      }>(json);
      return result?.assigned || [];
    },
    enabled: !!selectedEventId,
  });

  // Derive lanes from templates
  const derivedLanes = useMemo(() => {
    return deriveLanesFromTemplates(eventTemplates || []);
  }, [eventTemplates]);

  // Defensive: ensure shifts is always an array
  const shifts = Array.isArray(cachedShifts) ? cachedShifts : [];

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
      if (keys && keys.some((k) => k === "shifts" || k.startsWith("shifts:"))) {
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

  // Removed DnD context - React Flow handles drag/drop natively

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
        if (selectedEventId) {
          invalidateEventCache(selectedEventId, "shifts", "assignments");
        }
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
        if (selectedEventId) {
          invalidateEventCache(selectedEventId, "shifts");
        }
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
        if (selectedEventId) {
          invalidateEventCache(selectedEventId, "shifts", "assignments");
        }
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

  function handleExportCalendar() {
    if (!shifts || shifts.length === 0) {
      toast.error("No shifts to export");
      return;
    }

    const shiftsByDay = new Map<string, any[]>();
    for (const shift of shifts) {
      const day = format(new Date(shift.startTime), "yyyy-MM-dd");
      if (!shiftsByDay.has(day)) shiftsByDay.set(day, []);
      shiftsByDay.get(day)!.push(shift);
    }

    const html = Array.from(shiftsByDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, dayShifts]) => {
        const rows = dayShifts
          .sort(
            (a: any, b: any) =>
              new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
          )
          .map(
            (s: any) => `
          <tr>
            <td>${s.template?.name || s.type || "—"}</td>
            <td>${format(new Date(s.startTime), "HH:mm")} – ${format(new Date(s.endTime), "HH:mm")}</td>
            <td>${s.assignments?.map((a: any) => a.teamMember?.alias).join(", ") || "—"}</td>
            <td>${s.assignments?.length || 0}/${s.capacity}</td>
          </tr>
        `,
          )
          .join("");

        return `
        <h2>${format(new Date(day), "EEEE, d MMMM yyyy")}</h2>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
          <thead><tr><th>Shift</th><th>Time</th><th>Assigned</th><th>Capacity</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
      })
      .join("");

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
      <html><head><title>Schedule Export</title>
      <style>body{font-family:sans-serif;padding:20px}table{margin-bottom:20px}th{background:#f3f4f6}</style>
      </head><body><h1>Schedule: ${selectedEvent?.name ?? "Export"}</h1>${html}</body></html>
    `);
      printWindow.document.close();
      printWindow.print();
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
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {!selectedEventId && (
                <span className="text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg shrink-0">
                  Select an event from the header
                </span>
              )}
              {selectedEvent && (
                <span
                  className="text-sm font-bold text-gray-700 truncate max-w-[280px]"
                  title={selectedEvent.name}
                >
                  {selectedEvent.name}
                </span>
              )}
              <div className="flex rounded-lg overflow-hidden border border-gray-200 shrink-0">
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
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleExportCalendar}
                className={cn(
                  "flex items-center gap-2",
                  viewMode !== "calendar" && "invisible pointer-events-none",
                )}
              >
                <Download className="w-4 h-4" /> Export
              </Button>
              {selectedEvent &&
                (() => {
                  const nextStatus = getNextStatus(selectedEvent.status);
                  const prevStatus = getPreviousStatus(selectedEvent.status);
                  const action = nextStatus
                    ? STATUS_ACTION_LABELS[nextStatus]
                    : null;
                  const ActionIcon = action?.icon || Zap;

                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">
                        {selectedEvent.status.replace(/_/g, " ").toLowerCase()}
                      </span>
                      {action && nextStatus && (
                        <Button
                          variant="secondary"
                          onClick={() => handleTransition(nextStatus)}
                          className="flex items-center gap-2"
                        >
                          <ActionIcon className="w-4 h-4" /> {action.label}
                        </Button>
                      )}
                      {prevStatus && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTransition(prevStatus)}
                          className="text-xs text-gray-500"
                        >
                          ← Back to{" "}
                          {prevStatus.replace(/_/g, " ").toLowerCase()}
                        </Button>
                      )}
                    </div>
                  );
                })()}
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
        </div>

        {viewMode === "calendar" ? (
          <div className="space-y-2">
            {/* Template palette — above canvas, horizontal */}
            <TemplatePalette eventId={selectedEventId ?? undefined} layout="horizontal" />

            {/* Canvas row: canvas + optional shift details panel */}
            <div
              className="flex flex-row gap-0 rounded-xl shadow-sm overflow-hidden"
              data-event-status={selectedEvent?.status}
              style={{ backgroundColor: "var(--status-bg)", transition: "background-color 500ms" }}
            >
              {/* Canvas container */}
              <div
                ref={calendarRef}
                className="flex-1 min-w-0 relative"
              >
                {!selectedEvent ? (
                  <div className="p-12 text-center text-gray-400">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">
                      Select an event to view the calendar
                    </p>
                  </div>
                ) : (
                  <LaneCalendarCanvas
                    ref={canvasRef}
                    shifts={shifts}
                    lanes={derivedLanes}
                    eventStart={
                      selectedEvent ? new Date(selectedEvent.startDate) : null
                    }
                    eventEnd={
                      selectedEvent ? new Date(selectedEvent.endDate) : null
                    }
                    eventId={selectedEventId}
                    onShiftSelected={setSelectedShiftId}
                    onShiftCreated={() => refetchShifts()}
                    onShiftUpdated={() => refetchShifts()}
                    shiftMutationLocked={shiftMutationLocked}
                  />
                )}
              </div>

              {/* Shift properties panel — beside canvas when shift is selected */}
              {selectedShiftId && (
                <div className="w-80 flex-shrink-0 border-l border-gray-200 overflow-y-auto bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]">
                  <ShiftPropertiesPanel
                    shiftId={selectedShiftId}
                    eventStatus={selectedEvent?.status}
                    onClose={() => setSelectedShiftId(null)}
                    onUpdated={() => refetchShifts()}
                  />
                </div>
              )}
            </div>

            {/* Shift stats bar — below canvas */}
            {selectedEvent && shifts.length > 0 && (
              <div className="flex items-center gap-4 px-4 py-2 bg-white rounded-lg border border-gray-100 text-xs text-gray-600">
                <span className="text-gray-400 font-medium uppercase tracking-widest text-[10px]">
                  Coverage
                </span>
                <span className="flex items-center gap-1.5 text-success-700">
                  <span className="w-2 h-2 rounded-full bg-success-500 inline-block" />
                  {shifts.filter((s) => (s.assignments?.length ?? 0) >= s.capacity).length} fully staffed
                </span>
                <span className="flex items-center gap-1.5 text-accent-700">
                  <span className="w-2 h-2 rounded-full bg-accent-500 inline-block" />
                  {shifts.filter((s) => {
                    const c = s.assignments?.length ?? 0;
                    return c > 0 && c < s.capacity;
                  }).length} partial
                </span>
                <span className="flex items-center gap-1.5 text-red-700">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                  {shifts.filter((s) => (s.assignments?.length ?? 0) === 0).length} unstaffed
                </span>
                <span className="ml-auto text-gray-400">
                  {shifts.length} total shifts
                </span>
              </div>
            )}
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
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
                                    +
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                              <Users className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">
                                Capacity
                              </p>
                              <p className="text-sm font-bold text-gray-700 leading-none">
                                {shift.capacity}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                              <CheckCircle className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">
                                Assigned
                              </p>
                              <p className="text-sm font-bold text-gray-700 leading-none">
                                {shift.assignments?.length || 0}/{shift.capacity}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedShiftId(shift.id);
                          setViewMode("calendar");
                        }}
                        className="bg-gray-50 p-4 flex items-center justify-center text-gray-300 hover:text-primary-500 hover:bg-primary-50 transition-all border-l border-gray-100"
                        aria-label="Edit shift"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
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
                    Register Shift
                  </Button>
                </form>
              </Card>
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
        )}
      </div>
    </>
  );
}
