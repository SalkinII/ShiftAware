"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useCache } from "@/lib/cache/useCache";
import { SwapInterface } from "@/components/features/SwapInterface/SwapInterface";
import { format } from "date-fns";
import {
  RefreshCw,
  Play,
  Users,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowLeftRight,
  List,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Assignment {
  id: string;
  shiftId: string;
  teamMemberId: string;
  role: string;
  isLead: boolean;
  assignmentType: string;
  shift: {
    id: string;
    type: string;
    startTime: string;
    endTime: string;
    priority: string;
    event: { id: string; name: string };
  };
  teamMember: {
    id: string;
    alias: string;
    avatarId: string;
  };
}

interface Event {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  _count: { shifts: number };
}

export default function AssignmentsPage() {
  const toast = useToast();
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [runningAlgorithm, setRunningAlgorithm] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "swap">("list");

  // Use cache for events
  const {
    data: cachedEvents,
    loading: eventsLoading,
    refetch: refetchEvents,
  } = useCache<Event[]>({
    key: "events",
    fetchFn: async () => {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });

  // Use cache for assignments (all assignments, filtered client-side)
  const {
    data: allAssignments,
    loading: assignmentsLoading,
    refetch: refetchAssignments,
  } = useCache<Assignment[]>({
    key: "assignments",
    fetchFn: async () => {
      const res = await fetch("/api/assignments");
      if (!res.ok) throw new Error("Failed to fetch assignments");
      return res.json();
    },
  });

  const loading = eventsLoading || assignmentsLoading;

  // Filter assignments by selected event
  const assignments = useMemo(() => {
    if (!allAssignments) return [];
    if (!selectedEventId) return allAssignments;
    return allAssignments.filter((a) => a.shift.event.id === selectedEventId);
  }, [allAssignments, selectedEventId]);

  // Set default event on first load
  useEffect(() => {
    if (cachedEvents && cachedEvents.length > 0 && !selectedEventId) {
      setSelectedEventId(cachedEvents[0].id);
    }
  }, [cachedEvents, selectedEventId]);

  // Listen for cache invalidation events
  useEffect(() => {
    const handleCacheInvalidate = () => {
      refetchEvents();
      refetchAssignments();
    };

    window.addEventListener(
      "shiftaware:cache-invalidate",
      handleCacheInvalidate,
    );
    return () => {
      window.removeEventListener(
        "shiftaware:cache-invalidate",
        handleCacheInvalidate,
      );
    };
  }, [refetchEvents, refetchAssignments]);

  async function loadData() {
    await Promise.all([refetchEvents(), refetchAssignments()]);
  }

  async function runAlgorithm(eventId: string) {
    if (
      !confirm(
        "This will replace all existing assignments for this event. Continue?",
      )
    ) {
      return;
    }

    setRunningAlgorithm(true);
    toast.info("Running assignment algorithm...");
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });

      if (res.ok) {
        const result = await res.json();
        toast.success(
          `Algorithm completed! Created ${result.assignmentsCount} assignments.`,
        );
        // Invalidate cache for assignments and shifts
        window.dispatchEvent(
          new CustomEvent("shiftaware:cache-invalidate", {
            detail: {
              keys: ["assignments", "assignments*", "shifts", "shifts*"],
            },
          }),
        );
        await refetchAssignments();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to run algorithm");
      }
    } catch (error) {
      console.error("Run algorithm error:", error);
      toast.error("Failed to run algorithm. Please try again.");
    } finally {
      setRunningAlgorithm(false);
    }
  }

  const assignmentsByShift = assignments.reduce(
    (acc, assignment) => {
      if (!acc[assignment.shiftId]) {
        acc[assignment.shiftId] = [];
      }
      acc[assignment.shiftId].push(assignment);
      return acc;
    },
    {} as Record<string, Assignment[]>,
  );

  const uniqueShifts = Array.from(
    new Map(assignments.map((a) => [a.shift.id, a.shift])).values(),
  ).sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );

  async function handleSwap(
    assignment1Id: string,
    assignment2Id: string,
    reason?: string,
  ) {
    const res = await fetch("/api/assignments/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignment1Id,
        assignment2Id,
        reason,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to swap assignments");
    }

    // Invalidate cache for assignments and shifts
    window.dispatchEvent(
      new CustomEvent("shiftaware:cache-invalidate", {
        detail: { keys: ["assignments", "assignments*", "shifts", "shifts*"] },
      }),
    );
    await refetchAssignments();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" variant="text" />
        <SkeletonList count={5} />
      </div>
    );
  }

  return (
    <div className="p-6 lg:pl-70">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Assignment Control
            </h1>
            <p className="text-gray-500 font-medium mt-1">
              Manage shift assignments and run the assignment algorithm
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-1">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2",
                viewMode === "list"
                  ? "bg-primary-500 text-white"
                  : "text-gray-600 hover:bg-gray-50",
              )}
            >
              <List className="w-4 h-4" />
              List View
            </button>
            <button
              onClick={() => setViewMode("swap")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2",
                viewMode === "swap"
                  ? "bg-primary-500 text-white"
                  : "text-gray-600 hover:bg-gray-50",
              )}
            >
              <ArrowLeftRight className="w-4 h-4" />
              Swap View
            </button>
          </div>
        </div>

        {/* Event Selector */}
        <Card className="mb-6 p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <label className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2 block">
                Select Event
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 bg-white focus:border-primary-400 focus:outline-none"
              >
                <option value="">All Events</option>
                {cachedEvents?.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} ({format(new Date(event.startDate), "MMM d")} -{" "}
                    {format(new Date(event.endDate), "MMM d")})
                  </option>
                ))}
              </select>
            </div>
            {selectedEventId && (
              <div className="flex items-end">
                <Button
                  onClick={() => runAlgorithm(selectedEventId)}
                  disabled={runningAlgorithm}
                  className="flex items-center gap-2"
                >
                  {runningAlgorithm ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Run Assignment Algorithm
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">
              Total Assignments
            </p>
            <p className="text-3xl font-black text-gray-900">
              {assignments.length}
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="w-6 h-6 text-accent-600" />
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">
              Shifts with Assignments
            </p>
            <p className="text-3xl font-black text-gray-900">
              {uniqueShifts.length}
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="w-6 h-6 text-success-600" />
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">
              Unique Members
            </p>
            <p className="text-3xl font-black text-gray-900">
              {new Set(assignments.map((a) => a.teamMemberId)).size}
            </p>
          </Card>
        </div>

        {/* Swap Interface or Assignments List */}
        {viewMode === "swap" ? (
          <Card className="p-6">
            <SwapInterface
              assignments={assignments}
              onSwap={handleSwap}
              onRefresh={() => loadAssignments(selectedEventId)}
            />
          </Card>
        ) : uniqueShifts.length === 0 ? (
          <Card className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              No Assignments Found
            </h3>
            <p className="text-gray-500 mb-6">
              {selectedEventId
                ? "Run the assignment algorithm to create assignments for this event."
                : "Select an event and run the assignment algorithm to create assignments."}
            </p>
            {selectedEventId && (
              <Button onClick={() => runAlgorithm(selectedEventId)}>
                <Play className="w-4 h-4 mr-2" />
                Run Assignment Algorithm
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            {uniqueShifts.map((shift) => {
              const shiftAssignments = assignmentsByShift[shift.id] || [];
              return (
                <Card key={shift.id} className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">
                          {shift.type.replace(/_/g, " ")}
                        </h3>
                        <span
                          className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            shift.priority === "CORE"
                              ? "bg-primary-100 text-primary-700"
                              : "bg-gray-100 text-gray-600",
                          )}
                        >
                          {shift.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        {format(new Date(shift.startTime), "EEEE, MMM d, yyyy")}
                      </p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(shift.startTime), "h:mm a")} -{" "}
                        {format(new Date(shift.endTime), "h:mm a")}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {shift.event.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">
                        Assignments
                      </p>
                      <p className="text-2xl font-black text-gray-900">
                        {shiftAssignments.length}
                      </p>
                    </div>
                  </div>

                  {shiftAssignments.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
                      {shiftAssignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
                        >
                          <div className="text-2xl">
                            {assignment.teamMember.avatarId}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">
                              {assignment.teamMember.alias}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-semibold text-gray-500">
                                {assignment.role.replace(/_/g, " ")}
                              </span>
                              {assignment.isLead && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-primary-100 text-primary-700">
                                  Lead
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 pt-4 border-t border-gray-100 text-center text-sm text-gray-400">
                      No assignments for this shift
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
