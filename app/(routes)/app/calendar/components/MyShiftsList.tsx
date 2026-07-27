"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { Calendar, Clock, ArrowLeftRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface ShiftPreference {
  shiftId: string;
  wantLevel: "WANT" | "DONT_WANT";
  shift: {
    id: string;
    type: string;
    template?: { id: string; name: string } | null;
    startTime: string;
    endTime: string;
  };
}

interface Assignment {
  id: string;
  role: string;
  assignmentType: string;
  teamMember: { id: string; alias: string; avatarId: string };
}

interface Shift {
  id: string;
  type: string;
  templateId?: string | null;
  template?: { id: string; name: string } | null;
  startTime: string;
  endTime: string;
  priority: string;
  capacity: number;
  assignments: Assignment[];
  event: { name: string; id: string };
}

interface SwapRequestSummary {
  id: string;
  fromAssignmentId: string;
  status: "PENDING" | "MATCHED" | "DECLINED" | "APPROVED" | "CANCELLED";
}

interface MyShiftsListProps {
  shifts: Shift[];
  userId: string;
  teamMemberId: string;
  preferences?: ShiftPreference[];
  eventStatus: string;
  onVoteWant: (shiftId: string) => void;
  onVoteDontWant: (shiftId: string) => void;
  onVoteNeutral: (shiftId: string) => void;
  onRequestSwap: (assignmentId: string) => void;
  onCancelSwap: (swapRequestId: string) => void;
  swapRequests?: SwapRequestSummary[];
}

export function MyShiftsList({
  shifts,
  userId,
  preferences = [],
  eventStatus,
  onVoteWant,
  onVoteDontWant,
  onVoteNeutral,
  onRequestSwap,
  onCancelSwap,
  swapRequests = [],
}: MyShiftsListProps) {
  const preferenceMap = useMemo(() => {
    const map = new Map<string, "WANT" | "DONT_WANT">();
    preferences.forEach((p) => map.set(p.shiftId, p.wantLevel));
    return map;
  }, [preferences]);

  const mergedItems = useMemo(() => {
    const isPostFinalized = eventStatus === "FINALIZED" || eventStatus === "COMPLETED";

    const assignedShiftIds = new Set<string>();
    const assignedItems: { shiftId: string; shift: Shift; assigned: true }[] = [];

    shifts.forEach((shift) => {
      const isAssigned = (shift.assignments || []).some(
        (a) => a.teamMember?.id === userId,
      );
      if (isAssigned) {
        assignedShiftIds.add(shift.id);
        assignedItems.push({ shiftId: shift.id, shift, assigned: true });
      }
    });

    const preferenceOnlyItems: { shiftId: string; shift: ShiftPreference["shift"]; assigned: false }[] = [];

    if (!isPostFinalized) {
      preferences.forEach((p) => {
        if (!assignedShiftIds.has(p.shiftId)) {
          preferenceOnlyItems.push({ shiftId: p.shiftId, shift: p.shift, assigned: false });
        }
      });
    }

    return [...assignedItems, ...preferenceOnlyItems].sort(
      (a, b) =>
        new Date(a.shift.startTime).getTime() -
        new Date(b.shift.startTime).getTime(),
    );
  }, [shifts, userId, preferences, eventStatus]);

  const getUserAssignment = (shift: Shift) =>
    (shift.assignments || []).find((a) => a.teamMember?.id === userId);

  const getSwapRequest = (assignmentId: string) =>
    swapRequests.find((r) => r.fromAssignmentId === assignmentId);

  const showToggle = eventStatus === "OPEN_FOR_PREFERENCES";

  if (!userId) {
    return (
      <Card className="p-12 text-center">
        <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">Identity Not Set</h3>
        <p className="text-gray-500">
          Go to the{" "}
          <a href="/app/identity" className="text-primary-600 hover:underline">
            Identity page
          </a>{" "}
          to select your profile.
        </p>
      </Card>
    );
  }

  if (mergedItems.length === 0) {
    return (
      <Card className="p-6 text-center text-gray-400 text-sm">
        No shifts or preferences yet
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {mergedItems.map((item) => {
        const userPreference = preferenceMap.get(item.shiftId) ?? null;
        const shiftName =
          item.shift.template?.name ?? item.shift.type.replace(/_/g, " ");

        if (!item.assigned) {
          // Preference-only card
          return (
            <Card
              key={item.shiftId}
              className="p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-base font-semibold text-gray-900">{shiftName}</h4>
                    {userPreference && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: userPreference === "WANT" ? "#22c55e" : "#ef4444",
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(item.shift.startTime), "EEE, dd.MM.yyyy")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {format(new Date(item.shift.startTime), "HH:mm")} –{" "}
                      {format(new Date(item.shift.endTime), "HH:mm")}
                    </span>
                  </div>
                </div>
              </div>
              {showToggle && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <VoteToggle
                    shiftId={item.shiftId}
                    currentVote={userPreference}
                    onVoteWant={onVoteWant}
                    onVoteDontWant={onVoteDontWant}
                    onVoteNeutral={onVoteNeutral}
                  />
                </div>
              )}
            </Card>
          );
        }

        // Assigned shift card
        const shift = item.shift as Shift;
        const assignment = getUserAssignment(shift);

        return (
          <Card key={item.shiftId} className="p-5 hover:shadow-md transition-all">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <h4 className="text-lg font-bold text-gray-900 truncate">{shiftName}</h4>
                {userPreference && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: userPreference === "WANT" ? "#22c55e" : "#ef4444",
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>
              {assignment && (
                <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-primary-100 text-primary-700 flex-shrink-0">
                  {assignment.assignmentType}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {format(new Date(shift.startTime), "EEE, dd.MM.yyyy")}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {format(new Date(shift.startTime), "HH:mm")} –{" "}
                {format(new Date(shift.endTime), "HH:mm")}
              </span>
            </div>

            {showToggle && (
              <div className="flex gap-2 mt-2 mb-2">
                <VoteToggle
                  shiftId={item.shiftId}
                  currentVote={userPreference}
                  onVoteWant={onVoteWant}
                  onVoteDontWant={onVoteDontWant}
                  onVoteNeutral={onVoteNeutral}
                />
              </div>
            )}

            {assignment &&
              (() => {
                const swapReq = getSwapRequest(assignment.id);
                const status = swapReq?.status;

                if (status === "PENDING") {
                  return (
                    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                        Swap requested — pending
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCancelSwap(swapReq!.id)}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Cancel
                      </Button>
                    </div>
                  );
                }
                if (status === "MATCHED") {
                  return (
                    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                        Swap matched — awaiting admin
                      </span>
                    </div>
                  );
                }
                if (status === "DECLINED") {
                  return (
                    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                        Swap declined
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onRequestSwap(assignment.id)}
                        className="text-xs"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5 mr-1.5" />
                        Request Swap
                      </Button>
                    </div>
                  );
                }
                if (status === "APPROVED") {
                  return (
                    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary-100 text-primary-700">
                        Swap approved
                      </span>
                    </div>
                  );
                }
                return (
                  <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onRequestSwap(assignment.id)}
                      className="text-xs"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 mr-1.5" />
                      Request Swap
                    </Button>
                  </div>
                );
              })()}
          </Card>
        );
      })}
    </div>
  );
}

function VoteToggle({
  shiftId,
  currentVote,
  onVoteWant,
  onVoteDontWant,
  onVoteNeutral,
}: {
  shiftId: string;
  currentVote: "WANT" | "DONT_WANT" | null;
  onVoteWant: (id: string) => void;
  onVoteDontWant: (id: string) => void;
  onVoteNeutral: (id: string) => void;
}) {
  return (
    <>
      <button
        onClick={() => onVoteWant(shiftId)}
        aria-label="Want this shift"
        className={cn(
          "flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors",
          currentVote === "WANT"
            ? "bg-green-600 text-white"
            : "bg-green-50 text-green-700 hover:bg-green-100",
        )}
      >
        👍 Want
      </button>
      <button
        onClick={() => onVoteNeutral(shiftId)}
        aria-label="Neutral"
        className={cn(
          "flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors",
          currentVote == null
            ? "bg-gray-200 text-gray-700"
            : "bg-gray-50 text-gray-500 hover:bg-gray-100",
        )}
      >
        — Neutral
      </button>
      <button
        onClick={() => onVoteDontWant(shiftId)}
        aria-label="Don't want this shift"
        className={cn(
          "flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors",
          currentVote === "DONT_WANT"
            ? "bg-red-600 text-white"
            : "bg-red-50 text-red-700 hover:bg-red-100",
        )}
      >
        👎 Don&apos;t want
      </button>
    </>
  );
}
