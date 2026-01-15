"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useCache } from "@/lib/cache/useCache";
import { format } from "date-fns";
import { RefreshCw, Users, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoverageGap {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  priority: string;
  capacity: number;
  currentCount: number;
  event: { name: string };
  requiredRoles?: { role: string; count: number }[];
}

interface TeamMember {
  id: string;
  alias: string;
  avatarId: string;
  assignments: any[];
  preferences: any[];
}

export default function CoverageDashboard() {
  // Use cache for shifts and members
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

  const {
    data: cachedMembers,
    loading: membersLoading,
    refetch: refetchMembers,
  } = useCache<TeamMember[]>({
    key: "members",
    fetchFn: async () => {
      const res = await fetch("/api/members");
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });

  const loading = shiftsLoading || membersLoading;

  // Calculate gaps from cached shifts
  const gaps = useMemo(() => {
    if (!cachedShifts) return [];
    return cachedShifts
      .map((s: any) => ({
        id: s.id,
        type: s.type,
        startTime: s.startTime,
        endTime: s.endTime,
        priority: s.priority,
        capacity: s.capacity,
        currentCount: s.assignments?.length || 0,
        event: s.event,
        requiredRoles: s.requiredRoles,
      }))
      .filter((s: any) => s.currentCount < s.capacity);
  }, [cachedShifts]);

  // Listen for cache invalidation events
  useEffect(() => {
    const handleCacheInvalidate = () => {
      refetchShifts();
      refetchMembers();
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
  }, [refetchShifts, refetchMembers]);

  async function loadData() {
    await Promise.all([refetchShifts(), refetchMembers()]);
  }

  const quickFillRecommendations = useMemo(() => {
    if (!cachedMembers) return [];
    return gaps
      .filter((gap) => gap.currentCount === 0)
      .slice(0, 5)
      .map((gap) => {
        const needed = gap.capacity - gap.currentCount;
        const availableMembers = cachedMembers.filter((member) => {
          // Check if member has preferences for this shift
          const hasPreference = member.preferences?.some(
            (p: any) => p.shiftId === gap.id,
          );
          // Check if member is available (no overlapping assignments)
          const hasConflict = member.assignments?.some((a: any) => {
            const assignmentStart = new Date(a.shift?.startTime);
            const assignmentEnd = new Date(a.shift?.endTime);
            const gapStart = new Date(gap.startTime);
            const gapEnd = new Date(gap.endTime);
            return (
              (gapStart >= assignmentStart && gapStart < assignmentEnd) ||
              (gapEnd > assignmentStart && gapEnd <= assignmentEnd) ||
              (gapStart <= assignmentStart && gapEnd >= assignmentEnd)
            );
          });
          return hasPreference && !hasConflict;
        });

        return {
          gap,
          needed,
          recommendedMembers: availableMembers.slice(0, needed),
        };
      });
  }, [gaps, members]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const criticalGaps = gaps.filter((g) => g.currentCount === 0);
  const partialGaps = gaps.filter((g) => g.currentCount > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Coverage Gaps
          </h1>
          <p className="text-gray-500 font-medium">
            Identify and fill staffing gaps
          </p>
        </div>
        <Button
          variant="primary"
          onClick={loadData}
          className="flex items-center gap-2"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 rounded-2xl border border-red-100 bg-red-50">
          <p className="text-xs uppercase tracking-widest font-black text-red-700">
            Unstaffed
          </p>
          <p className="text-2xl font-black text-red-900 mt-1">
            {criticalGaps.length}
          </p>
          <p className="text-red-700 text-sm">Shifts need attention</p>
        </Card>
        <Card className="p-4 rounded-2xl border border-accent-100 bg-accent-50">
          <p className="text-xs uppercase tracking-widest font-black text-accent-700">
            Partial
          </p>
          <p className="text-2xl font-black text-accent-900 mt-1">
            {partialGaps.length}
          </p>
          <p className="text-accent-700 text-sm">Need more coverage</p>
        </Card>
        <Card className="p-4 rounded-2xl border border-success-100 bg-success-50">
          <p className="text-xs uppercase tracking-widest font-black text-success-700">
            Coverage
          </p>
          <p className="text-2xl font-black text-success-900 mt-1">
            {gaps.length === 0
              ? "100%"
              : `${Math.round(
                  ((gaps.length - criticalGaps.length) / gaps.length) * 100,
                )}%`}
          </p>
          <p className="text-success-700 text-sm">Overall status</p>
        </Card>
      </div>

      {quickFillRecommendations.length > 0 && (
        <Card className="p-6 bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
          <div className="flex items-center gap-3 mb-4">
            <Lightbulb className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-bold text-gray-900">
              Quick-Fill Recommendations
            </h2>
          </div>
          <div className="space-y-3">
            {quickFillRecommendations.map((rec) => (
              <div
                key={rec.gap.id}
                className="p-4 bg-white rounded-xl border border-primary-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-gray-900">
                      {rec.gap.type.replace("_", " ")}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {format(new Date(rec.gap.startTime), "MMM d, HH:mm")} -{" "}
                      {format(new Date(rec.gap.endTime), "HH:mm")}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-bold">
                    Need {rec.needed}
                  </span>
                </div>
                {rec.recommendedMembers.length > 0 ? (
                  <div className="flex items-center gap-2 mt-3">
                    <Users className="w-4 h-4 text-gray-400" />
                    <div className="flex items-center gap-2">
                      {rec.recommendedMembers.map((member) => (
                        <span
                          key={member.id}
                          className="px-2 py-1 rounded-lg bg-primary-50 text-primary-700 text-xs font-semibold flex items-center gap-1"
                        >
                          <span>{member.avatarId}</span>
                          {member.alias}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-2">
                    No members with preferences available
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-gray-500">
          All Coverage Gaps
        </h2>

        {gaps.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-500 italic">
              No coverage gaps found! All shifts are fully staffed.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {gaps
              .sort((a, b) => a.currentCount - b.currentCount)
              .map((gap) => (
                <Card
                  key={gap.id}
                  className={cn(
                    "p-4",
                    gap.currentCount === 0
                      ? "border-l-4 border-l-red-500 bg-red-50"
                      : "border-l-4 border-l-accent-500 bg-accent-50",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full",
                            gap.currentCount === 0
                              ? "bg-red-500"
                              : "bg-accent-500",
                          )}
                        ></span>
                        <h3 className="font-bold text-gray-900">
                          {gap.type.replace("_", " ")}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600">
                        {gap.event.name} •{" "}
                        {format(new Date(gap.startTime), "MMM d, HH:mm")} -{" "}
                        {format(new Date(gap.endTime), "HH:mm")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-gray-900">
                        {gap.currentCount} / {gap.capacity}
                      </p>
                      <p className="text-xs text-gray-500 uppercase">Staffed</p>
                    </div>
                  </div>
                </Card>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
