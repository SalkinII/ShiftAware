"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  Users,
  Clock,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useCache } from "@/lib/cache/useCache";
import Link from "next/link";
import { format } from "date-fns";

interface Event {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  _count: { shifts: number };
}

interface Stats {
  totalMembers: number;
  totalShifts: number;
  coveredShifts: number;
  unstaffedShifts: number;
}

export default function DashboardPage() {
  const toast = useToast();
  const [stats, setStats] = useState<Stats>({
    totalMembers: 0,
    totalShifts: 0,
    coveredShifts: 0,
    unstaffedShifts: 0,
  });
  const [runningAlgorithm, setRunningAlgorithm] = useState(false);

  // Use cache for events, members, and shifts
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

  const {
    data: cachedMembers,
    loading: membersLoading,
    refetch: refetchMembers,
  } = useCache<any[]>({
    key: "members",
    fetchFn: async () => {
      const res = await fetch("/api/members");
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });

  const {
    data: cachedShifts,
    loading: shiftsLoading,
    refetch: refetchShifts,
  } = useCache<any[]>({
    key: "shifts",
    fetchFn: async () => {
      const res = await fetch("/api/shifts");
      if (!res.ok) throw new Error("Failed to fetch shifts");
      return res.json();
    },
  });

  const loading = eventsLoading || membersLoading || shiftsLoading;

  // Calculate stats when data changes
  useEffect(() => {
    if (cachedEvents && cachedMembers && cachedShifts) {
      const covered = cachedShifts.filter(
        (s: any) => s.assignments?.length >= s.capacity,
      ).length;
      const unstaffed = cachedShifts.filter(
        (s: any) => s.assignments?.length === 0,
      ).length;

      setStats({
        totalMembers: cachedMembers.length,
        totalShifts: cachedShifts.length,
        coveredShifts: covered,
        unstaffedShifts: unstaffed,
      });
    }
  }, [cachedEvents, cachedMembers, cachedShifts]);

  // Listen for cache invalidation events
  useEffect(() => {
    const handleCacheInvalidate = (e: CustomEvent) => {
      const keys = e.detail?.keys || [];
      // Only refetch if our cache keys are affected
      if (
        keys.some(
          (k: string) =>
            k === "events" ||
            k.startsWith("events") ||
            k === "members" ||
            k.startsWith("members") ||
            k === "shifts" ||
            k.startsWith("shifts"),
        )
      ) {
        refetchEvents();
        refetchMembers();
        refetchShifts();
      }
    };

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
  }, []); // Empty deps - refetch functions are stable from useCache

  async function loadData() {
    await Promise.all([refetchEvents(), refetchMembers(), refetchShifts()]);
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
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });

      if (res.ok) {
        const result = await res.json();
        toast.success(
          `Algorithm completed! Created ${result.assignments.length} assignments.`,
        );
        // Invalidate cache for assignments and shifts
        window.dispatchEvent(
          new CustomEvent("shiftaware:cache-invalidate", {
            detail: {
              keys: ["assignments", "assignments*", "shifts", "shifts*"],
            },
          }),
        );
        await loadData();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to run algorithm");
      }
    } catch (error) {
      console.error("Failed to run algorithm:", error);
      toast.error("Failed to run algorithm. Please try again.");
    } finally {
      setRunningAlgorithm(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" variant="text" />
          <Skeleton className="h-4 w-96" variant="text" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  const coveragePercent =
    stats.totalShifts > 0
      ? Math.round((stats.coveredShifts / stats.totalShifts) * 100)
      : 0;

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center text-4xl shadow-sm border border-primary-200">
            🦊
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Welcome back, Admin
            </h1>
            <p className="text-gray-500 font-medium">
              Here&apos;s what&apos;s happening with Starlight Meadow Festival
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/schedule">
            <Button
              variant="secondary"
              className="flex items-center gap-2 bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              <Calendar className="w-4 h-4" />
              View Schedule
            </Button>
          </Link>
          <Button className="flex items-center gap-2 shadow-lg shadow-primary-500/20">
            <TrendingUp className="w-4 h-4" />
            Quick Report
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-sm hover:shadow-md transition-all p-6 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-primary-50 rounded-lg text-primary-600 group-hover:bg-primary-500 group-hover:text-white transition-colors">
              <Calendar className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-success-600 bg-success-50 px-2 py-1 rounded-full">
              +12%
            </span>
          </div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">
            Total Shifts
          </p>
          <p className="text-3xl font-black text-gray-900">
            {stats.totalShifts}
          </p>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-all p-6 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-accent-50 rounded-lg text-accent-600 group-hover:bg-accent-500 group-hover:text-white transition-colors">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-accent-600 bg-accent-50 px-2 py-1 rounded-full">
              Active
            </span>
          </div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">
            Team Members
          </p>
          <p className="text-3xl font-black text-gray-900">
            {stats.totalMembers}
          </p>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-all p-6 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-success-50 rounded-lg text-success-600 group-hover:bg-success-500 group-hover:text-white transition-colors">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-success-500"
                style={{ width: `${coveragePercent}%` }}
              ></div>
            </div>
          </div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">
            Staffing Level
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-black text-gray-900">
              {coveragePercent}%
            </p>
            <p className="text-xs text-gray-500 font-medium">
              {stats.coveredShifts} covered
            </p>
          </div>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-all p-6 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-50 rounded-lg text-red-600 group-hover:bg-red-500 group-hover:text-white transition-colors">
              <AlertCircle className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
              Action Required
            </span>
          </div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">
            Unstaffed
          </p>
          <p className="text-3xl font-black text-gray-900">
            {stats.unstaffedShifts}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content: Events */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              Upcoming Events
              <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                {cachedEvents?.length || 0}
              </span>
            </h2>
            <Link
              href="/admin/shifts"
              className="text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              Manage all shifts <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid gap-4">
            {cachedEvents?.map((event) => (
              <Card
                key={event.id}
                className="bg-white border-none shadow-sm overflow-hidden flex flex-col md:flex-row"
              >
                <div className="w-full md:w-48 bg-primary-50 p-6 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-primary-100">
                  <p className="text-xs font-bold text-primary-400 uppercase tracking-widest mb-1">
                    {format(new Date(event.startDate), "MMM")}
                  </p>
                  <p className="text-4xl font-black text-primary-600 leading-none">
                    {format(new Date(event.startDate), "dd")}
                  </p>
                  <p className="text-xs font-bold text-primary-400 mt-2">
                    2026
                  </p>
                </div>
                <div className="flex-1 p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-bold text-gray-900">
                        {event.name}
                      </h3>
                      <span className="px-3 py-1 rounded-full bg-accent-50 text-accent-700 text-[10px] font-bold uppercase tracking-wider">
                        {event.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 font-medium">
                      {format(new Date(event.startDate), "EEEE, MMM do")} -{" "}
                      {format(new Date(event.endDate), "EEEE, MMM do")}
                    </p>
                    <div className="mt-4 flex items-center gap-4 text-xs text-gray-400 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> {event._count.shifts}{" "}
                        SHIFTS
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> MULTI-TEAM
                      </span>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={() => runAlgorithm(event.id)}
                      disabled={runningAlgorithm}
                      className="bg-primary-600 hover:bg-primary-700 shadow-md shadow-primary-500/10 text-xs font-bold uppercase tracking-wider px-6"
                    >
                      {runningAlgorithm
                        ? "Processing..."
                        : "Run Assignment Engine"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Sidebar: Quick Actions & Notifications */}
        <div className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>
            <div className="grid gap-3">
              <Link href="/preferences">
                <button className="w-full p-4 rounded-2xl bg-white shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4 group">
                  <div className="p-3 bg-primary-50 rounded-xl text-primary-600 group-hover:bg-primary-500 group-hover:text-white transition-colors">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">
                      Enter Preferences
                    </p>
                    <p className="text-xs text-gray-500">Pick your shifts</p>
                  </div>
                </button>
              </Link>
              <Link href="/admin/members">
                <button className="w-full p-4 rounded-2xl bg-white shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4 group">
                  <div className="p-3 bg-accent-50 rounded-xl text-accent-600 group-hover:bg-accent-500 group-hover:text-white transition-colors">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">
                      Manage Team
                    </p>
                    <p className="text-xs text-gray-500">30 members active</p>
                  </div>
                </button>
              </Link>
              <Link href="/admin/coverage">
                <button className="w-full p-4 rounded-2xl bg-white shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4 group">
                  <div className="p-3 bg-red-50 rounded-xl text-red-600 group-hover:bg-red-500 group-hover:text-white transition-colors">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">
                      Review Gaps
                    </p>
                    <p className="text-xs text-gray-500">
                      {stats.unstaffedShifts} needs attention
                    </p>
                  </div>
                </button>
              </Link>
            </div>
          </div>

          <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6 border-none shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/10 rounded-full -mr-12 -mt-12 blur-3xl"></div>
            <h3 className="text-lg font-bold mb-2">Algorithm Power</h3>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              Our assignment engine balances gender, experience, and member
              preferences automatically.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full bg-gray-700 border-2 border-gray-800 flex items-center justify-center text-[10px]"
                  >
                    {["🐺", "🦊", "🐻"][i - 1]}
                  </div>
                ))}
              </div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider ml-2">
                Smart Balancing active
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
