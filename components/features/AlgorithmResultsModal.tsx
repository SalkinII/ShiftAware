"use client";

import { useState } from "react";
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
  workloadFairness: number;
  overall: number;
}

interface PreviewResult {
  assignments: PreviewAssignment[];
  violations: string[];
  scores: Record<string, PreviewScore>;
  explanations: Record<string, string>;
  ruleMatchSummaries?: string[];
  memberAliases?: Record<string, string>;
  shiftCoverage?: Record<string, { assigned: number; capacity: number }>;
}

interface AlgorithmResultsModalProps {
  result: PreviewResult;
  onClose: () => void;
  eventId?: string;
}

export function AlgorithmResultsModal({
  result,
  onClose,
  eventId,
}: AlgorithmResultsModalProps) {
  const [exporting, setExporting] = useState(false);
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
    memberCounts.set(
      a.teamMemberId,
      (memberCounts.get(a.teamMemberId) || 0) + 1,
    );
  }

  const getMemberLabel = (id: string) => result.memberAliases?.[id] ?? id;

  async function handleExportPdf() {
    if (!eventId) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/shifts?eventId=${eventId}`);
      if (!res.ok) throw new Error("Failed to fetch shifts");
      const json = await res.json();
      const shifts: any[] = json.data ?? [];

      // Group proposed assignments by shiftId
      const assignmentsByShift = new Map<string, string[]>();
      for (const a of result.assignments) {
        const alias = getMemberLabel(a.teamMemberId);
        if (!assignmentsByShift.has(a.shiftId)) {
          assignmentsByShift.set(a.shiftId, []);
        }
        assignmentsByShift.get(a.shiftId)!.push(alias);
      }

      // Build HTML grouped by day — same structure as schedule page "Export as PDF Table"
      const shiftsByDay = new Map<string, any[]>();
      for (const shift of shifts) {
        const day = shift.startTime.slice(0, 10); // "yyyy-MM-dd"
        if (!shiftsByDay.has(day)) shiftsByDay.set(day, []);
        shiftsByDay.get(day)!.push(shift);
      }

      const html = Array.from(shiftsByDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, dayShifts]) => {
          const rows = dayShifts
            .sort(
              (a: any, b: any) =>
                new Date(a.startTime).getTime() -
                new Date(b.startTime).getTime(),
            )
            .map((s: any) => {
              const proposed = assignmentsByShift.get(s.id) ?? [];
              const startHHMM = new Date(s.startTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              });
              const endHHMM = new Date(s.endTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              });
              return `<tr>
              <td>${s.template?.name ?? s.type ?? "—"}</td>
              <td>${startHHMM} – ${endHHMM}</td>
              <td>${proposed.join(", ") || "—"}</td>
              <td>${proposed.length}/${s.capacity}</td>
            </tr>`;
            })
            .join("");

          const dateLabel = new Date(day + "T12:00:00").toLocaleDateString(
            undefined,
            { weekday: "long", day: "numeric", month: "long", year: "numeric" },
          );

          return `<h2>${dateLabel}</h2>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
          <thead><tr><th>Shift</th><th>Time</th><th>Proposed</th><th>Capacity</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
        })
        .join("");

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
        <html><head><title>Preview Export</title>
        <style>body{font-family:sans-serif;padding:20px}table{margin-bottom:20px}th{background:#f3f4f6}</style>
        </head><body>
        <h1>Algorithm Preview — Proposed Schedule</h1>
        <p style="color:#666;font-size:14px">No assignments saved — simulation only</p>
        ${html}
        </body></html>
      `);
        printWindow.document.close();
        printWindow.print();
      }
    } catch {
      // Silent fail — export is best-effort
    } finally {
      setExporting(false);
    }
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
              <div className="text-xs text-primary-600 uppercase tracking-wide break-words">
                Assignments
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-700">
                {avgScore.toFixed(1)}
              </div>
              <div className="text-xs text-gray-600 uppercase tracking-wide break-words">
                Avg Score
              </div>
            </div>
            <div
              className={`text-center p-3 rounded-lg ${
                totalViolations > 0 ? "bg-red-50" : "bg-green-50"
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
                className={`text-xs uppercase tracking-wide break-words ${
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
          {result.ruleMatchSummaries &&
            result.ruleMatchSummaries.length > 0 && (
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

          {/* Per-assignment score breakdown */}
          {Object.keys(result.scores).length > 0 && (
            <div>
              <h4 className="text-md font-bold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary-500" />
                Score Breakdown
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {result.assignments.map((a, i) => {
                  const key = `${a.teamMemberId}-${a.shiftId}`;
                  const score = result.scores[key];
                  if (!score) return null;
                  return (
                    <div
                      key={i}
                      className="p-3 bg-gray-50 rounded-lg text-sm border border-gray-200"
                    >
                      <div className="font-medium text-gray-900 mb-1">
                        {getMemberLabel(a.teamMemberId)} → Shift{" "}
                        {a.shiftId.slice(0, 8)}…
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-xs text-gray-600">
                        <span>Pref: {score.preferenceMatch}</span>
                        <span>Work: {score.workloadFairness}</span>
                        <span className="font-bold text-gray-900">
                          Overall: {score.overall.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Understaffed shifts */}
          {result.shiftCoverage &&
            Object.keys(result.shiftCoverage).length > 0 &&
            (() => {
              const understaffed = Object.entries(result.shiftCoverage).filter(
                ([, { assigned, capacity }]) => assigned < capacity,
              );
              return understaffed.length > 0 ? (
                <div>
                  <h4 className="text-md font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Understaffed Shifts
                  </h4>
                  <div className="space-y-2">
                    {understaffed.map(([shiftId, { assigned, capacity }]) => (
                      <div
                        key={shiftId}
                        className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800"
                      >
                        <span>Shift {shiftId.slice(0, 8)}…</span>
                        <span className="font-bold">
                          {assigned}/{capacity}
                        </span>
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
                      {getMemberLabel(memberId)}
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
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-2">
          {eventId && (
            <Button
              onClick={handleExportPdf}
              variant="secondary"
              className="flex-1"
              disabled={exporting}
            >
              {exporting ? "Exporting…" : "Export as PDF"}
            </Button>
          )}
          <Button
            onClick={onClose}
            variant="primary"
            className={eventId ? "flex-1" : "w-full"}
          >
            Close Preview
          </Button>
        </div>
      </Card>
    </div>
  );
}
