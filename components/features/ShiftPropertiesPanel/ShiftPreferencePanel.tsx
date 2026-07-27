"use client";

import { Clock, Users, Star } from "lucide-react";
import { format } from "date-fns";

interface ShiftPreferencePanelProps {
  shift: {
    id: string;
    type: string;
    startTime: string;
    endTime: string;
    capacity: number;
    assignmentCount?: number;
    desirabilityScore?: number;
    templateName?: string;
    assignedMembers?: Array<{ alias: string }>;
  };
  teamMemberId: string;
  currentVote?: "WANT" | "DONT_WANT" | null;
  onVoteWant: (shiftId: string) => void;
  onVoteDontWant: (shiftId: string) => void;
  onVoteNeutral: (shiftId: string) => void;
  onClose: () => void;
}

export function ShiftPreferencePanel({
  shift,
  currentVote,
  onVoteWant,
  onVoteDontWant,
  onVoteNeutral,
  onClose,
}: ShiftPreferencePanelProps) {
  return (
    <div className="h-full flex flex-col bg-white/90 backdrop-blur-sm border-l border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {shift.templateName || shift.type.replace(/_/g, " ")}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          &times;
        </button>
      </div>

      {/* Shift details */}
      <div className="p-4 space-y-4 flex-1">
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="w-4 h-4" />
          <span>
            {format(new Date(shift.startTime), "HH:mm")} –{" "}
            {format(new Date(shift.endTime), "HH:mm")}
          </span>
        </div>

        {shift.desirabilityScore != null && (
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            <span className="text-amber-500 font-bold">
              {"+".repeat(shift.desirabilityScore)}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 text-gray-600">
          <Users className="w-4 h-4" />
          <span>
            {shift.assignmentCount ?? 0}/{shift.capacity} staffed
          </span>
        </div>
      </div>

      {/* Three-state vote buttons */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={() => onVoteWant(shift.id)}
            aria-label="Want this shift"
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors ${
              currentVote === "WANT"
                ? "bg-green-600 text-white"
                : "bg-green-50 text-green-700 hover:bg-green-100"
            }`}
          >
            👍 Want
          </button>
          <button
            onClick={() => onVoteNeutral(shift.id)}
            aria-label="Neutral"
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors ${
              currentVote == null
                ? "bg-gray-200 text-gray-700"
                : "bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            — Neutral
          </button>
          <button
            onClick={() => onVoteDontWant(shift.id)}
            aria-label="Don't want this shift"
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors ${
              currentVote === "DONT_WANT"
                ? "bg-red-600 text-white"
                : "bg-red-50 text-red-700 hover:bg-red-100"
            }`}
          >
            👎 Don&apos;t want
          </button>
        </div>
      </div>
    </div>
  );
}
