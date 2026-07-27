"use client";

import type { Violation } from "@/lib/algorithm/types";

interface RedistributeResult {
  assignments: unknown[];
  violations: Violation[];
}

interface Props {
  dryRunResult: RedistributeResult;
  onConfirm: () => void;
  onCancel: () => void;
  isCommitting: boolean;
}

export function RedistributeOverlay({
  dryRunResult,
  onConfirm,
  onCancel,
  isCommitting,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-xl space-y-4">
        <h2 className="text-lg font-semibold">Confirm Redistribute</h2>
        <p className="text-sm text-gray-600">
          {dryRunResult.assignments.length} assignments computed.
          {dryRunResult.violations.length > 0 && (
            <span className="text-red-600 ml-1">
              ⚠ {dryRunResult.violations.length} violations.
            </span>
          )}
        </p>
        {dryRunResult.violations.length > 0 && (
          <ul className="text-xs text-red-600 max-h-32 overflow-y-auto">
            {dryRunResult.violations.map((v, i) => (
              <li key={i}>{v.detail}</li>
            ))}
          </ul>
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isCommitting}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isCommitting ? "Committing..." : "Commit"}
          </button>
        </div>
      </div>
    </div>
  );
}
