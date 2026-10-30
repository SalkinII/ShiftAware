"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Calendar, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useEnvironmentContext, type EnvironmentSummary } from "@/lib/contexts/EnvironmentContext";

export type EntryRoute =
  | { type: "none" }
  | { type: "join" }
  | { type: "direct"; environmentId: string }
  | { type: "picker" };

export function resolveEntryRoute(
  registrations: { environmentId: string; festivalId: string }[],
  joinableCount: number,
): EntryRoute {
  if (registrations.length === 0) return joinableCount === 0 ? { type: "none" } : { type: "join" };
  if (registrations.length === 1) return { type: "direct", environmentId: registrations[0].environmentId };
  return { type: "picker" };
}

interface EnvironmentSelectionStepProps {
  memberId: string;
  onEnvironmentSelected: (environmentId: string) => void;
  onBack: () => void;
}

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export function EnvironmentSelectionStep({
  memberId,
  onEnvironmentSelected,
  onBack,
}: EnvironmentSelectionStepProps) {
  const { environments, loading: environmentsLoading } = useEnvironmentContext();
  const [registeredIds, setRegisteredIds] = useState<string[] | null>(null);
  const [festivalNames, setFestivalNames] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/members/${memberId}`)
      .then((res) => (res.ok ? res.json() : { data: null }))
      .then((body) => {
        const registrations: { environment: { id: string } | null }[] =
          body.data?.environmentRegistrations ?? [];
        setRegisteredIds(
          registrations.filter((r) => r.environment).map((r) => r.environment!.id),
        );
      })
      .catch(() => setRegisteredIds([]));
  }, [memberId]);

  useEffect(() => {
    fetch("/api/festivals")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body) => {
        const festivals: { id: string; name: string }[] = body.data ?? [];
        setFestivalNames(Object.fromEntries(festivals.map((f) => [f.id, f.name])));
      })
      .catch(() => setFestivalNames({}));
  }, []);

  const loading = environmentsLoading || registeredIds === null;
  const registered = environments.filter((e) => registeredIds?.includes(e.id));
  const joinable = environments.filter((e) => !registeredIds?.includes(e.id));
  const route = resolveEntryRoute(
    registered.map((e) => ({ environmentId: e.id, festivalId: e.festivalId })),
    joinable.length,
  );
  const directId = route.type === "direct" ? route.environmentId : null;

  useEffect(() => {
    if (loading || !directId) return;
    // Auto-forward only on first visit, not when the user navigated back
    const autoForwardKey = `shiftaware:environmentAutoForward:${memberId}`;
    if (!sessionStorage.getItem(autoForwardKey)) {
      sessionStorage.setItem(autoForwardKey, "done");
      onEnvironmentSelected(directId);
    }
  }, [loading, directId, memberId, onEnvironmentSelected]);

  async function register(environmentId: string) {
    try {
      const res = await fetch(`/api/environments/${environmentId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (res.ok) {
        onEnvironmentSelected(environmentId);
      } else {
        const error = await res.json();
        alert(error.message || "Failed to join environment");
      }
    } catch (error) {
      console.error("Failed to join environment:", error);
      alert("Failed to join environment");
    }
  }

  if (loading) {
    return (
      <Card className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-20 bg-gray-200 rounded" />
        </div>
      </Card>
    );
  }

  if (route.type === "none") {
    return (
      <Card className="p-8 text-center">
        <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">No festival yet</h2>
        <p className="text-gray-500 mb-6">
          An admin has not set up a festival yet. Please check back later.
        </p>
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </Card>
    );
  }

  const renderCard = (environment: EnvironmentSummary, action: "select" | "join") => (
    <Card
      key={environment.id}
      className={cn(
        "p-6 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] hover:border-primary-300",
        action === "join" && "border-2 border-dashed",
      )}
      onClick={() => (action === "select" ? onEnvironmentSelected(environment.id) : register(environment.id))}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
          <Calendar className="w-6 h-6 text-primary-600" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-gray-400 uppercase">
            {festivalNames[environment.festivalId] ?? ""}
          </p>
          <h3 className="font-bold text-gray-900">{environment.name}</h3>
          <p className="text-sm text-gray-500">
            {formatDate(environment.startDate)} - {formatDate(environment.endDate)}
          </p>
          <span className="inline-block text-xs font-semibold px-2 py-1 rounded mt-1 bg-gray-100 text-gray-700">
            {environment.status.toLowerCase().replace(/_/g, " ")}
          </span>
        </div>
        {action === "select" ? (
          <CheckCircle className="w-6 h-6 text-primary-600" />
        ) : (
          <span className="text-sm text-primary-600 font-medium">Join →</span>
        )}
      </div>
    </Card>
  );

  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Select Your Environment</h1>
          <p className="text-gray-500">Choose where you want to work</p>
        </div>
      </div>

      {registered.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Your environments</h2>
          <div className="grid grid-cols-1 gap-4">
            {registered.map((environment) => renderCard(environment, "select"))}
          </div>
        </div>
      )}

      {joinable.length > 0 && (
        <div className="space-y-4 mt-8">
          <h2 className="text-lg font-semibold text-gray-900">
            {registered.length > 0 ? "Join another" : "Join an environment"}
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {joinable.map((environment) => renderCard(environment, "join"))}
          </div>
        </div>
      )}
    </>
  );
}
