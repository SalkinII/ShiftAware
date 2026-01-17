"use client";

import React, { useCallback } from "react";
import { SwapInterface } from "@/components/features/SwapInterface/SwapInterface";
import { useCache } from "@/lib/cache/useCache";
import { useToast } from "@/components/ui/Toast";

interface Assignment {
  id: string;
  shiftId: string;
  teamMemberId: string;
  role: string;
  shift: {
    id: string;
    type: string;
    startTime: string;
    endTime: string;
    priority: string;
    capacity: number;
    event: { name: string };
  };
  teamMember: {
    id: string;
    alias: string;
    avatarId: string;
  };
}

export default function SwapPage() {
  const toast = useToast();

  const {
    data: assignments,
    loading,
    refetch,
  } = useCache<Assignment[]>({
    key: "assignments-for-swap",
    fetchFn: async () => {
      const res = await fetch("/api/assignments");
      if (!res.ok) throw new Error("Failed to fetch assignments");
      const data = await res.json();
      return data.data || data || [];
    },
  });

  const handleSwap = useCallback(
    async (assignment1Id: string, assignment2Id: string, reason?: string) => {
      try {
        const res = await fetch("/api/assignments/swap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignment1Id,
            assignment2Id,
            reason,
          }),
        });

        if (res.ok) {
          toast.success("Shift swap completed successfully");
          refetch();
        } else {
          const error = await res.json();
          toast.error(error.error || "Failed to swap shifts");
        }
      } catch (error) {
        console.error("Swap error:", error);
        toast.error("Failed to swap shifts");
      }
    },
    [toast, refetch]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shift Swap</h1>
          <p className="text-sm text-gray-500 mt-1">
            Request to swap shifts with other team members
          </p>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shift Swap</h1>
        <p className="text-sm text-gray-500 mt-1">
          Request to swap shifts with other team members
        </p>
      </div>

      <SwapInterface
        assignments={assignments || []}
        onSwap={handleSwap}
        onRefresh={refetch}
      />
    </div>
  );
}
