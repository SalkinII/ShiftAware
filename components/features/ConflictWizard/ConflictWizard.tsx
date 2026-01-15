"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { AlertCircle, CheckCircle, X, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConflictType =
  | "SHIFT_OVERLAP"
  | "SHIFT_CAPACITY"
  | "GENDER_BALANCE"
  | "MINIMUM_SHIFTS";

export interface Conflict {
  id: string;
  type: ConflictType;
  severity: "hard" | "soft";
  message: string;
  affectedEntities: {
    shifts?: string[];
    members?: string[];
    assignments?: string[];
  };
  suggestions: ResolutionSuggestion[];
}

export interface ResolutionSuggestion {
  action: "SWAP" | "UNASSIGN" | "ASSIGN" | "REASSIGN";
  description: string;
  affectedAssignments?: string[];
  targetMember?: string;
  targetShift?: string;
  confidence: number;
}

interface ConflictWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConflictWizard({ isOpen, onClose }: ConflictWizardProps) {
  const toast = useToast();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    byType: Record<ConflictType, number>;
    bySeverity: Record<"hard" | "soft", number>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentConflictIndex, setCurrentConflictIndex] = useState(0);
  const [selectedSuggestion, setSelectedSuggestion] = useState<{
    conflictId: string;
    suggestion: ResolutionSuggestion;
  } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    if (isOpen) {
      scanConflicts();
    }
  }, [isOpen]);

  async function scanConflicts() {
    setLoading(true);
    try {
      const res = await fetch("/api/conflicts");
      if (!res.ok) {
        throw new Error("Failed to scan conflicts");
      }
      const data = await res.json();
      setConflicts(data.conflicts || []);
      setSummary(data.summary || null);
      setCurrentConflictIndex(0);
    } catch (error) {
      console.error("Failed to scan conflicts:", error);
      toast.error("Failed to scan conflicts");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectSuggestion(
    conflictId: string,
    suggestion: ResolutionSuggestion,
  ) {
    setSelectedSuggestion({ conflictId, suggestion });
    setShowConfirmDialog(true);
  }

  async function confirmResolution() {
    if (!selectedSuggestion) return;

    setResolving(true);
    try {
      const res = await fetch("/api/conflicts/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conflictId: selectedSuggestion.conflictId,
          resolution: {
            action: selectedSuggestion.suggestion.action,
            assignmentIds: selectedSuggestion.suggestion.affectedAssignments,
            targetMemberId: selectedSuggestion.suggestion.targetMember,
            targetShiftId: selectedSuggestion.suggestion.targetShift,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message || data.error || "Failed to resolve conflict",
        );
      }

      toast.success(data.message || "Conflict resolved successfully");

      // Invalidate cache
      window.dispatchEvent(
        new CustomEvent("shiftaware:cache-invalidate", {
          detail: {
            keys: ["shifts", "shifts*", "assignments", "assignments*"],
          },
        }),
      );

      // Rescan conflicts
      await scanConflicts();

      // Move to next conflict or close if none left
      if (currentConflictIndex < conflicts.length - 1) {
        setCurrentConflictIndex((prev) => prev + 1);
      } else if (conflicts.length <= 1) {
        // If this was the last conflict, close wizard
        onClose();
      }

      setShowConfirmDialog(false);
      setSelectedSuggestion(null);
    } catch (error) {
      console.error("Failed to resolve conflict:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to resolve conflict";
      toast.error(errorMessage);
    } finally {
      setResolving(false);
    }
  }

  function handleSkip() {
    if (currentConflictIndex < conflicts.length - 1) {
      setCurrentConflictIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  }

  function handleClose() {
    if (resolving) return;
    setShowConfirmDialog(false);
    setSelectedSuggestion(null);
    setCurrentConflictIndex(0);
    onClose();
  }

  if (!isOpen) return null;

  const currentConflict = conflicts[currentConflictIndex];
  const progress =
    conflicts.length > 0 ? (currentConflictIndex + 1) / conflicts.length : 0;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-wizard-title"
      >
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={handleClose}
          aria-hidden="true"
        />

        {/* Wizard */}
        <Card className="relative z-10 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
            <div className="flex-1">
              <h2
                id="conflict-wizard-title"
                className="text-2xl font-bold text-gray-900 mb-2"
              >
                Conflict Resolution Wizard
              </h2>
              {summary && (
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>
                    <span className="font-semibold">{summary.total}</span>{" "}
                    conflict
                    {summary.total !== 1 ? "s" : ""} found
                  </span>
                  {summary.bySeverity.hard > 0 && (
                    <span className="text-red-600 font-semibold">
                      {summary.bySeverity.hard} hard
                    </span>
                  )}
                </div>
              )}
              {/* Progress bar */}
              {conflicts.length > 0 && (
                <div className="mt-3">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 transition-all duration-300"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Conflict {currentConflictIndex + 1} of {conflicts.length}
                  </p>
                </div>
              )}
            </div>
            {!resolving && (
              <button
                onClick={handleClose}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Close wizard"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                <span className="ml-3 text-gray-600">
                  Scanning for conflicts...
                </span>
              </div>
            ) : conflicts.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-success-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  No Conflicts Found
                </h3>
                <p className="text-gray-600">
                  Your schedule is conflict-free! All assignments are valid.
                </p>
              </div>
            ) : currentConflict ? (
              <div className="space-y-6">
                {/* Conflict Details */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle
                      className={cn(
                        "w-5 h-5",
                        currentConflict.severity === "hard"
                          ? "text-red-500"
                          : "text-yellow-500",
                      )}
                    />
                    <span
                      className={cn(
                        "px-2 py-1 rounded text-xs font-bold uppercase",
                        currentConflict.severity === "hard"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700",
                      )}
                    >
                      {currentConflict.severity}
                    </span>
                    <span className="px-2 py-1 rounded text-xs font-semibold text-gray-600 bg-gray-100">
                      {currentConflict.type.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-gray-700 font-medium">
                    {currentConflict.message}
                  </p>
                </div>

                {/* Resolution Suggestions */}
                {currentConflict.suggestions.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-3">
                      Suggested Resolutions
                    </h3>
                    <div className="space-y-2">
                      {currentConflict.suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() =>
                            handleSelectSuggestion(
                              currentConflict.id,
                              suggestion,
                            )
                          }
                          disabled={resolving}
                          className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900 mb-1">
                                {suggestion.description}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                <span className="px-2 py-0.5 rounded bg-gray-100">
                                  {suggestion.action}
                                </span>
                                <span>
                                  Confidence:{" "}
                                  {Math.round(suggestion.confidence * 100)}%
                                </span>
                              </div>
                            </div>
                            <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-200">
                    <p className="text-sm text-yellow-800">
                      No automatic suggestions available. Please resolve
                      manually using the assignments page.
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          {conflicts.length > 0 && currentConflict && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                onClick={handleSkip}
                disabled={resolving}
              >
                {currentConflictIndex < conflicts.length - 1 ? "Skip" : "Close"}
              </Button>
              <div className="text-sm text-gray-500">
                {conflicts.length - currentConflictIndex - 1} remaining
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => {
          if (!resolving) {
            setShowConfirmDialog(false);
            setSelectedSuggestion(null);
          }
        }}
        onConfirm={confirmResolution}
        title="Confirm Resolution"
        message={
          selectedSuggestion
            ? `Are you sure you want to ${selectedSuggestion.suggestion.action.toLowerCase()}? ${selectedSuggestion.suggestion.description}`
            : ""
        }
        confirmText="Apply Resolution"
        cancelText="Cancel"
        variant="default"
        isLoading={resolving}
      />
    </>
  );
}
