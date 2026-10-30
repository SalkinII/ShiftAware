"use client";

import { useCallback, useEffect, useState } from "react";
import { EnvironmentSwitcher } from "@/components/ui/EnvironmentSwitcher";
import { useEnvironmentContext, type EnvironmentSummary } from "@/lib/contexts/EnvironmentContext";
import { useMemberContext } from "@/lib/hooks/useMemberContext";

interface JoinableRow {
  id: string;
  name: string;
  festivalId: string;
  status: string;
  missingQuestionCount: number;
}

export function MemberEnvironmentSwitcher() {
  const { selectedMemberId } = useMemberContext();
  const { environments, selectedEnvironment, setSelectedEnvironmentId } = useEnvironmentContext();
  const [festivalNames, setFestivalNames] = useState<Record<string, string>>({});
  const [registeredIds, setRegisteredIds] = useState<string[] | null>(null);
  const [joinable, setJoinable] = useState<JoinableRow[]>([]);

  const loadMemberLists = useCallback(async () => {
    if (!selectedMemberId) return;
    const [memberRes, joinableRes] = await Promise.all([
      fetch(`/api/members/${selectedMemberId}`),
      fetch(`/api/members/${selectedMemberId}/joinable-environments`),
    ]);
    const memberBody = memberRes.ok ? await memberRes.json() : { data: null };
    const registrations: { environment: { id: string } | null }[] =
      memberBody.data?.environmentRegistrations ?? [];
    setRegisteredIds(registrations.filter((r) => r.environment).map((r) => r.environment!.id));
    const joinableBody = joinableRes.ok ? await joinableRes.json() : { data: [] };
    setJoinable(joinableBody.data ?? []);
  }, [selectedMemberId]);

  useEffect(() => {
    loadMemberLists();
  }, [loadMemberLists]);

  useEffect(() => {
    fetch("/api/festivals")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body) => {
        const festivals: { id: string; name: string }[] = body.data ?? [];
        setFestivalNames(Object.fromEntries(festivals.map((f) => [f.id, f.name])));
      })
      .catch(() => setFestivalNames({}));
  }, []);

  const toSummary = (environment: EnvironmentSummary) => ({
    id: environment.id,
    name: environment.name,
    festivalId: environment.festivalId,
    festivalName: festivalNames[environment.festivalId] ?? "",
    status: environment.status,
    shiftCount: environment._count?.shifts ?? 0,
  });

  // A member sees the environments they joined; an admin session without a member sees all of them
  const isMember = Boolean(selectedMemberId) && registeredIds !== null;
  const myEnvironments = (
    isMember ? environments.filter((e) => registeredIds!.includes(e.id)) : environments
  ).map(toSummary);
  const joinableList = isMember
    ? joinable.map((row) => ({
        id: row.id,
        name: row.name,
        festivalId: row.festivalId,
        festivalName: festivalNames[row.festivalId] ?? "",
        missingQuestionCount: row.missingQuestionCount,
      }))
    : [];

  if (myEnvironments.length === 0 && joinableList.length === 0) return null;

  async function join(environmentId: string) {
    if (!selectedMemberId) return;
    const res = await fetch(`/api/environments/${environmentId}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: selectedMemberId }),
    });
    if (res.ok) {
      await loadMemberLists();
      setSelectedEnvironmentId(environmentId);
    }
  }

  return (
    <EnvironmentSwitcher
      activeEnvironment={selectedEnvironment ? toSummary(selectedEnvironment) : null}
      myEnvironments={myEnvironments}
      joinable={joinableList}
      onSelect={setSelectedEnvironmentId}
      onJoin={join}
    />
  );
}
