"use client";

import { ThumbsUp, ThumbsDown, Clock, Users, Star } from "lucide-react";
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
  currentVote?: "WANT" | "DONT_WANT" | null;
  onVoteWant: (shiftId: string) => void;
  onVoteDontWant: (shiftId: string) => void;
  onClose: () => void;
}

export function ShiftPreferencePanel({
  shift,
  currentVote,
  onVoteWant,
  onVoteDontWant,
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
              {"★".repeat(shift.desirabilityScore)}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 text-gray-600">
          <Users className="w-4 h-4" />
          <span>
            {shift.assignmentCount ?? 0}/{shift.capacity} staffed
          </span>
        </div>

        {/* Current vote status */}
        {currentVote && (
          <div
            className={`p-3 rounded-lg text-sm font-medium ${
              currentVote === "WANT"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            You voted: {currentVote === "WANT" ? "Want" : "Don't want"} this
            shift
          </div>
        )}
      </div>

      {/* Vote buttons — large and prominent */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <button
          onClick={() => onVoteWant(shift.id)}
          className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-colors ${
            currentVote === "WANT"
              ? "bg-green-600 text-white"
              : "bg-green-50 text-green-700 hover:bg-green-100"
          }`}
        >
          <ThumbsUp className="w-5 h-5" />
          Want this shift
        </button>
        <button
          onClick={() => onVoteDontWant(shift.id)}
          className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-colors ${
            currentVote === "DONT_WANT"
              ? "bg-red-600 text-white"
              : "bg-red-50 text-red-700 hover:bg-red-100"
          }`}
        >
          <ThumbsDown className="w-5 h-5" />
          Don't want this shift
        </button>
      </div>
    </div>
  );
}
