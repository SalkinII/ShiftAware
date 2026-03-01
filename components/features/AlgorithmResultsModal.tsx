"use client";

import { X, AlertTriangle, CheckCircle, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface PreviewAssignment {
  shiftId: string;
  teamMemberId: string;
  role: string;
  assignmentType: string;
}

interface PreviewScore {
  preferenceMatch: number;
  experienceBalance: number;
  workloadFairness: number;
  coreShiftCoverage: number;
  overall: number;
}

interface PreviewResult {
  assignments: PreviewAssignment[];
  violations: string[];
  scores: Record<string, PreviewScore>;
  explanations: Record<string, string>;
  ruleMatchSummaries?: string[];
}

interface AlgorithmResultsModalProps {
  result: PreviewResult;
  onClose: () => void;
}

export function AlgorithmResultsModal({
  result,
  onClose,
}: AlgorithmResultsModalProps) {
  const totalAssignments = result.assignments.length;
  const totalViolations = result.violations.length;

  // Calculate average score
  const scoreValues = Object.values(result.scores);
  const avgScore =
    scoreValues.length > 0
      ? scoreValues.reduce((sum, s) => sum + s.overall, 0) / scoreValues.length
      : 0;

  // Group assignments by member
  const memberCounts = new Map<string, number>();
  for (const a of result.assignments) {
    memberCounts.set(a.teamMemberId, (memberCounts.get(a.teamMemberId) || 0) + 1);
  }

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <Card className="max-w-2xl w-full bg-white shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-6 text-white rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold mb-2">Preview Results</h3>
              <p className="text-primary-100 text-sm">
                Algorithm simulation — no assignments saved
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Summary Bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-primary-50 rounded-lg">
              <div className="text-2xl font-bold text-primary-700">
                {totalAssignments}
              </div>
              <div className="text-xs text-primary-600 uppercase tracking-widest">
                Assignments
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-700">
                {avgScore.toFixed(1)}
              </div>
              <div className="text-xs text-gray-600 uppercase tracking-widest">
                Avg Score
              </div>
            </div>
            <div
              className={`text-center p-3 rounded-lg ${
                totalViolations > 0
                  ? "bg-red-50"
                  : "bg-green-50"
              }`}
            >
              <div
                className={`text-2xl font-bold ${
                  totalViolations > 0 ? "text-red-700" : "text-green-700"
                }`}
              >
                {totalViolations}
              </div>
              <div
                className={`text-xs uppercase tracking-widest ${
                  totalViolations > 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                Violations
              </div>
            </div>
          </div>

          {/* Rest Period Violations */}
          {(() => {
            const restViolations = result.violations.filter((v) =>
              /rest|insufficient/i.test(v),
            );
            return restViolations.length > 0 ? (
              <div>
                <h4 className="text-md font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Rest Period Violations
                </h4>
                <div className="space-y-2">
                  {restViolations.map((v, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800"
                    >
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {v}
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          {/* Rule Filter Exclusions */}
          {result.ruleMatchSummaries && result.ruleMatchSummaries.length > 0 && (
            <div>
              <h4 className="text-md font-bold text-gray-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Rule Match Summary
              </h4>
              <div className="space-y-2">
                {result.ruleMatchSummaries.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800"
                  >
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other Constraint Violations */}
          {(() => {
            const otherViolations = result.violations.filter(
              (v) => !/rest|insufficient/i.test(v),
            );
            return otherViolations.length > 0 ? (
              <div>
                <h4 className="text-md font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Other Constraint Violations
                </h4>
                <div className="space-y-2">
                  {otherViolations.map((v, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800"
                    >
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {v}
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          {/* Member Coverage */}
          <div>
            <h4 className="text-md font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-500" />
              Member Coverage ({memberCounts.size} members)
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {Array.from(memberCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([memberId, count]) => (
                  <div
                    key={memberId}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                  >
                    <span className="text-gray-700 truncate">
                      {memberId.slice(0, 8)}...
                    </span>
                    <span className="font-bold text-gray-900">
                      {count} shifts
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <Button onClick={onClose} variant="primary" className="w-full">
            Close Preview
          </Button>
        </div>
      </Card>
    </div>
  );
}
