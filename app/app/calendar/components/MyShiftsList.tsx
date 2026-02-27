"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import {
  Calendar,
  Clock,
  ThumbsUp,
  ThumbsDown,
  ArrowLeftRight,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface ShiftPreference {
  shiftId: string;
  wantLevel: "WANT" | "DONT_WANT";
  shift: {
    id: string;
    type: string;
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
  startTime: string;
  endTime: string;
  priority: string;
  capacity: number;
  assignments: Assignment[];
  event: { name: string; id: string };
}

interface MyShiftsListProps {
  shifts: Shift[];
  userId: string;
  preferences?: ShiftPreference[];
  onVoteWant: (shiftId: string) => void;
  onVoteDontWant: (shiftId: string) => void;
  onRequestSwap: (assignmentId: string) => void;
}

export function MyShiftsList({
  shifts,
  userId,
  preferences,
  onVoteWant,
  onVoteDontWant,
  onRequestSwap,
}: MyShiftsListProps) {
  // Filter shifts to only show user's assignments
  const myShifts = useMemo(() => {
    if (!userId) return [];
    return shifts
      .filter((shift) =>
        (shift.assignments || []).some((a) => a.teamMember?.id === userId),
      )
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
  }, [shifts, userId]);

  const myPreferences = useMemo(() => {
    if (!preferences) return [];
    return preferences.sort(
      (a, b) =>
        new Date(a.shift.startTime).getTime() -
        new Date(b.shift.startTime).getTime(),
    );
  }, [preferences]);

  const assignedShiftIds = useMemo(() => {
    return new Set(myShifts.map((s) => s.id));
  }, [myShifts]);

  // Get user's assignment for a shift
  const getUserAssignment = (shift: Shift) => {
    return (shift.assignments || []).find((a) => a.teamMember?.id === userId);
  };

  if (!userId) {
    return (
      <Card className="p-12 text-center">
        <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          Identity Not Set
        </h3>
        <p className="text-gray-500">
          Go to the{" "}
          <a href="/app/identity" className="text-primary-600 hover:underline">
            Identity page
          </a>{" "}
          to select your profile, then return here.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* My Assignments Section */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">
          My Assignments ({myShifts.length})
        </h3>
        {myShifts.length === 0 ? (
          <Card className="p-6 text-center text-gray-400 text-sm">
            No shifts assigned yet
          </Card>
        ) : (
          <div className="space-y-3">
            {myShifts.map((shift) => {
              const assignment = getUserAssignment(shift);
              return (
                <Card key={shift.id} className="p-5 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-lg font-bold text-gray-900">
                          {shift.type.replace(/_/g, " ")}
                        </h4>
                        {assignment && (
                          <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-primary-100 text-primary-700">
                            {assignment.assignmentType}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(shift.startTime), "EEE, dd.MM.yyyy")}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          {format(new Date(shift.startTime), "HH:mm")} –{" "}
                          {format(new Date(shift.endTime), "HH:mm")}
                        </div>
                      </div>
                      {assignment && (
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
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* My Preferences Section */}
      {myPreferences.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">
            My Preferences ({myPreferences.length})
          </h3>
          <div className="space-y-2">
            {myPreferences.map((pref) => {
              const isFulfilled =
                pref.wantLevel === "WANT" && assignedShiftIds.has(pref.shiftId);
              const isViolated =
                pref.wantLevel === "DONT_WANT" &&
                assignedShiftIds.has(pref.shiftId);

              return (
                <Card
                  key={pref.shiftId}
                  className={cn(
                    "p-4 flex items-center gap-3",
                    isViolated && "border-red-200 bg-red-50",
                    isFulfilled && "border-green-200 bg-green-50",
                  )}
                >
                  {pref.wantLevel === "WANT" ? (
                    <ThumbsUp
                      className={cn(
                        "w-4 h-4 flex-shrink-0",
                        isFulfilled ? "text-green-600" : "text-gray-400",
                      )}
                    />
                  ) : (
                    <ThumbsDown
                      className={cn(
                        "w-4 h-4 flex-shrink-0",
                        isViolated ? "text-red-600" : "text-gray-400",
                      )}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900">
                      {pref.shift.type.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      {format(new Date(pref.shift.startTime), "EEE dd.MM HH:mm")}
                    </span>
                  </div>
                  {isFulfilled && (
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  )}
                  {isViolated && (
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
