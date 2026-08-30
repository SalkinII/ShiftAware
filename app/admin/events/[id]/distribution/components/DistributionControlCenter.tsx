"use client";

import { useState, useCallback } from "react";
import { DistributionHeatmap } from "./DistributionHeatmap";
import { AnalysisTable } from "./AnalysisTable";

interface Props {
  eventId: string;
  eventStatus: string;
  eventName: string;
}

export function DistributionControlCenter({
  eventId,
  eventStatus,
  eventName,
}: Props) {
  const [previewData, setPreviewData] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const handleDryRun = useCallback(async () => {
    setIsRunning(true);
    try {
      const res = await fetch(`/api/events/${eventId}/assignments/preview`, {
        method: "POST",
      });
      const json = await res.json();
      setPreviewData(json.data);
    } finally {
      setIsRunning(false);
    }
  }, [eventId]);

  const handleRun = useCallback(async () => {
    if (
      !confirm(
        "Run algorithm and commit assignments? This will overwrite current assignments.",
      )
    )
      return;
    setIsRunning(true);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (res.ok) {
        setPreviewData(null);
        window.location.reload();
      }
    } finally {
      setIsRunning(false);
    }
  }, [eventId]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={handleDryRun}
          disabled={isRunning}
          className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
        >
          {isRunning ? "Running..." : "Dry Run"}
        </button>
        <button
          onClick={handleRun}
          disabled={
            isRunning ||
            eventStatus === "PLANNING" ||
            eventStatus === "OPEN_FOR_PREFERENCES"
          }
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          Run Algorithm
        </button>
        {previewData && (
          <span className="text-sm text-amber-600 self-center">
            Preview — not committed. {previewData.violations?.length ?? 0}{" "}
            violations.
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <DistributionHeatmap
          eventId={eventId}
          previewData={previewData}
          highlightMemberId={selectedMemberId}
          onMemberSelect={setSelectedMemberId}
        />
        <AnalysisTable
          eventId={eventId}
          eventName={eventName}
          onMemberSelect={setSelectedMemberId}
          selectedMemberId={selectedMemberId}
        />
      </div>
    </div>
  );
}
