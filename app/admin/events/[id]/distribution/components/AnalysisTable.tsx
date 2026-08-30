"use client";

import { useEffect, useState } from "react";
import { unwrapApiResponse } from "@/lib/api-errors";
import { exportDistributionAnalysisToPDF } from "@/lib/utils/export";

interface AnalysisMember {
  id: string;
  alias: string;
  avatarId: string;
  assignedCount: number;
  minShifts: number;
  maxShifts: number;
  byType: Record<string, number>;
  violations: string[];
}

interface Props {
  eventId: string;
  eventName: string;
  onMemberSelect: (id: string | null) => void;
  selectedMemberId: string | null;
}

export function AnalysisTable({
  eventId,
  eventName,
  onMemberSelect,
  selectedMemberId,
}: Props) {
  const [data, setData] = useState<{ members: AnalysisMember[] } | null>(null);
  const [violationsOnly, setViolationsOnly] = useState(false);

  useEffect(() => {
    fetch(`/api/events/${eventId}/distribution/analysis`)
      .then((r) => r.json())
      .then((json) => setData(unwrapApiResponse(json)));
  }, [eventId]);

  if (!data) return <div className="text-sm text-gray-400">Loading analysis...</div>;

  const members = violationsOnly
    ? data.members.filter((m) => m.violations.length > 0)
    : data.members;

  return (
    <div className="border rounded p-3 overflow-auto">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium">Analysis</span>
        <label className="flex items-center gap-1 text-xs cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={violationsOnly}
            onChange={(e) => setViolationsOnly(e.target.checked)}
          />
          Violations only
        </label>
        <button
          onClick={() => exportDistributionAnalysisToPDF(eventName, data.members)}
          className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
        >
          Export PDF
        </button>
      </div>
      <table className="text-xs w-full">
        <thead>
          <tr className="text-left border-b">
            <th className="py-1 pr-3">Member</th>
            <th className="py-1 pr-3">Assigned</th>
            <th className="py-1 pr-3">Min</th>
            <th className="py-1 pr-3">Max</th>
            <th className="py-1">Violations</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr
              key={m.id}
              onClick={() =>
                onMemberSelect(m.id === selectedMemberId ? null : m.id)
              }
              className={`cursor-pointer border-b hover:bg-gray-50
                ${selectedMemberId === m.id ? "bg-yellow-50" : ""}
                ${m.violations.length > 0 ? "text-red-700" : ""}`}
            >
              <td className="py-1 pr-3 font-medium">
                {m.avatarId} {m.alias}
              </td>
              <td className="py-1 pr-3">{m.assignedCount}</td>
              <td className="py-1 pr-3">{m.minShifts}</td>
              <td className="py-1 pr-3">
                {m.maxShifts === Infinity ? "∞" : m.maxShifts}
              </td>
              <td className="py-1">
                {m.violations.length > 0 ? (
                  <span className="text-red-600">⚠ {m.violations.length}</span>
                ) : (
                  <span className="text-green-600">✓</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
