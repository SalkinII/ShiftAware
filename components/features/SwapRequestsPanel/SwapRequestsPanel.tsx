"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ArrowRight, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import type { EventStatus } from "@prisma/client";
import { unwrapApiResponse } from "@/lib/api-errors";
import { canShowSwapPanel } from "@/lib/services/event-status-permissions";
import { cn } from "@/lib/utils";

interface SwapRequest {
  id: string;
  status: "PENDING" | "MATCHED";
  matchedWithId?: string | null;
  requester: { alias: string };
  fromAssignment: {
    role: string;
    shift: {
      template?: { name: string } | null;
      type: string;
      startTime: string;
      endTime: string;
    };
  };
  toShift: {
    template?: { name: string } | null;
    type: string;
    startTime: string;
    endTime: string;
    capacity: number;
    assignments: { id: string }[];
  };
}

interface SwapRequestsPanelProps {
  eventId: string | null;
  eventStatus?: EventStatus;
  onHasRequests?: (has: boolean, count?: number) => void;
  onRefresh?: () => void;
}

function shiftName(shift: { template?: { name: string } | null; type: string }) {
  return shift.template?.name ?? shift.type.replace(/_/g, " ");
}

function shiftTime(startTime: string, endTime: string) {
  return `${format(new Date(startTime), "EEE dd.MM HH:mm")}–${format(new Date(endTime), "HH:mm")}`;
}

export function SwapRequestsPanel({
  eventId,
  eventStatus,
  onHasRequests,
  onRefresh,
}: SwapRequestsPanelProps) {
  const toast = useToast();
  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const fetchRequests = useCallback(() => {
    if (!eventId) return;
    if (eventStatus && !canShowSwapPanel(eventStatus)) {
      onHasRequests?.(false);
      return;
    }
    onHasRequests?.(false);
    setLoading(true);
    setError(null);
    fetch(`/api/swap-requests?eventId=${eventId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        const all = unwrapApiResponse<SwapRequest[]>(data) || [];
        const filtered = all.filter(
          (r) =>
            r.status === "PENDING" ||
            (r.status === "MATCHED" && r.matchedWithId != null),
        );
        setRequests(filtered);
        onHasRequests?.(filtered.length > 0, filtered.length);
      })
      .catch(() => setError("Failed to load swap requests"))
      .finally(() => setLoading(false));
  }, [eventId, eventStatus, onHasRequests]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  if (!eventId) return null;

  if (eventStatus && !canShowSwapPanel(eventStatus)) return null;

  async function handleAction(id: string, status: "APPROVED" | "DECLINED") {
    setActing(id);
    try {
      const res = await fetch(`/api/swap-requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(status === "APPROVED" ? "Swap approved" : "Swap declined");
        fetchRequests();
        onRefresh?.();
      } else {
        const err = await res.json();
        toast.error(err.message || "Action failed");
      }
    } catch {
      toast.error("Action failed");
    } finally {
      setActing(null);
    }
  }

  if (loading && requests.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-400 text-center">
        Loading swap requests…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600 text-center space-y-2">
        <p>{error}</p>
        <Button variant="secondary" size="sm" onClick={fetchRequests}>
          Retry
        </Button>
      </div>
    );
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
        Swap Requests ({requests.length})
      </h4>
      {requests.map((req) => {
        const fillCount = req.toShift.assignments.length;
        const isActing = acting === req.id;

        return (
          <Card key={req.id} className="p-4 space-y-3">
            {/* Header: alias + status badge */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">
                {req.requester.alias}
              </span>
              <span
                className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  req.status === "MATCHED"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700",
                )}
              >
                {req.status}
              </span>
            </div>

            {/* From → To */}
            <div className="text-xs text-gray-600 space-y-1">
              <div>
                <span className="font-semibold text-gray-500 uppercase tracking-widest text-[10px]">
                  FROM{" "}
                </span>
                {shiftName(req.fromAssignment.shift)} ·{" "}
                {shiftTime(
                  req.fromAssignment.shift.startTime,
                  req.fromAssignment.shift.endTime,
                )}
              </div>
              <div className="flex items-center gap-1">
                <ArrowRight className="w-3 h-3 text-gray-400" />
                <span className="font-semibold text-gray-500 uppercase tracking-widest text-[10px]">
                  TO{" "}
                </span>
                {shiftName(req.toShift)} ·{" "}
                {shiftTime(req.toShift.startTime, req.toShift.endTime)}
              </div>
            </div>

            {/* Meta: capacity */}
            <div className="text-[10px] text-gray-400 flex items-center gap-3">
              <span>
                Target: {fillCount} / {req.toShift.capacity} assigned
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1 items-center">
              {req.status === "PENDING" && (
                <span className="text-[10px] text-amber-600 italic flex-1">
                  Waiting for partner
                </span>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleAction(req.id, "DECLINED")}
                disabled={isActing}
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <XCircle className="w-3.5 h-3.5 mr-1" />
                Decline
              </Button>
              {req.status === "MATCHED" && (
                <Button
                  size="sm"
                  onClick={() => handleAction(req.id, "APPROVED")}
                  disabled={isActing}
                  className="text-xs ml-auto"
                >
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                  Approve
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
