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
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import CalendarView from "@/components/features/Calendar/CalendarView";
import { addDays, format } from "date-fns";
import { cn } from "@/lib/utils";
import { useCache } from "@/lib/cache/useCache";
import { unwrapApiResponse } from "@/lib/api-errors";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";

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

// User Calendar View - Read-only schedule display
export default function UserCalendarPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<"Day" | "Week" | "Grid">("Week");
  const [currentEventDate, setCurrentEventDate] = useState<string>();
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

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
    const savedView = localStorage.getItem("shiftaware:user-calendar:view");
    if (savedView === "Day" || savedView === "Week" || savedView === "Grid") {
      setViewType(savedView);
    }
  }, []);

  // Update shifts when cache data changes
  useEffect(() => {
    if (cachedShifts) {
      // Ensure shifts is always an array
      const shiftsArray = Array.isArray(cachedShifts) ? cachedShifts : [];
      setShifts(shiftsArray);
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
      const bufferDays = eventData.config?.bufferDaysBefore || 0;
      const festivalStart = addDays(new Date(eventData.startDate), -bufferDays);
      setCurrentEventDate(format(festivalStart, "yyyy-MM-dd"));
    } else if (shifts.length > 0) {
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
    localStorage.setItem("shiftaware:user-calendar:view", viewType);
  }, [viewType]);

  function coverageState(shift: Shift): CoverageState {
    const filled = shift.assignments?.length || 0;
    if (filled >= shift.capacity) return "full";
    if (filled > 0) return "partial";
    return "empty";
  }

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
      if (viewType === "Day" && currentEventDate) {
        const shiftDate = shift.startTime.split("T")[0];
        if (shiftDate !== currentEventDate) return false;
      }

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

  function handleShiftClick(data: { id: string }) {
    const shift = filteredShifts.find((s) => s.id === data.id);
    setSelectedShift(shift || null);
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
    <div className="space-y-8 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            My Schedule
          </h1>
          <p className="text-gray-500 font-medium">
            View your shift assignments and team coverage
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            variant="secondary"
            className="shadow-sm"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
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
              <p className="text-3xl font-black mt-1">{metrics.coverage}%</p>
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
              {(["all", "full", "partial", "empty"] as const).map((option) => (
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
                  {option === "all" ? "All" : coverageLegend[option].label}
                </button>
              ))}
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

      <Card className="p-0 shadow-xl overflow-hidden h-[calc(100vh-340px)] min-h-[600px] flex flex-col bg-white">
        <CalendarView
          shifts={filteredShifts}
          viewType={viewType}
          startDate={currentEventDate}
          showAssignments={true}
          onAssignmentClick={handleShiftClick}
          onDateChange={(date) => setCurrentEventDate(date)}
          eventRange={eventRange || undefined}
          // No edit/delete handlers - read-only view
        />
      </Card>

      {/* Shift Details Modal - Read-only */}
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
                    {format(new Date(selectedShift.startTime), "EEEE, MMM d")}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {format(new Date(selectedShift.startTime), "HH:mm")} -{" "}
                    {format(new Date(selectedShift.endTime), "HH:mm")}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-8">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" />
                    Assignments ({selectedShift.assignments?.length || 0} /{" "}
                    {selectedShift.capacity})
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
                                  {(a.algorithmScore.overall * 100).toFixed(0)}{" "}
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
                    Assignment Notes
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

            <div className="px-8 pb-8 flex justify-end">
              <Button
                variant="secondary"
                onClick={() => setSelectedShift(null)}
                className="bg-gray-100 text-gray-600 border-none hover:bg-gray-200 px-8 py-3 rounded-2xl font-bold uppercase tracking-widest text-xs"
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
