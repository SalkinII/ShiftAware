"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { EnvironmentSwitcher } from "@/components/ui/EnvironmentSwitcher";
import { useToast } from "@/components/ui/Toast";
import { AttributePromptModal } from "@/components/features/Identity/AttributePromptModal";
import { useEnvironmentContext, type EnvironmentSummary } from "@/lib/contexts/EnvironmentContext";
import { useMemberContext } from "@/lib/hooks/useMemberContext";
import type { AttributeDefinitionLike } from "@/lib/utils/attribute-check";

interface JoinableRow {
  id: string;
  name: string;
  festivalId: string;
  status: string;
  missingQuestionCount: number;
}

interface PendingQuestions {
  environmentId: string;
  definitions: AttributeDefinitionLike[];
  initialValues: Record<string, unknown>;
}

export function MemberEnvironmentSwitcher() {
  const pathname = usePathname();
  const toast = useToast();
  const { selectedMemberId } = useMemberContext();
  const { environments, selectedEnvironment, setSelectedEnvironmentId } = useEnvironmentContext();
  const [festivalNames, setFestivalNames] = useState<Record<string, string>>({});
  const [registeredIds, setRegisteredIds] = useState<string[] | null>(null);
  const [joinable, setJoinable] = useState<JoinableRow[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestions | null>(null);

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

  // Admin pages manage every environment; a member sees the environments they joined and can join more
  const isMember =
    !pathname.startsWith("/admin") && Boolean(selectedMemberId) && registeredIds !== null;
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

  // Switching into an environment asks first for the questions the member has not answered
  async function enterEnvironment(environmentId: string) {
    const res = await fetch(
      `/api/environments/${environmentId}/members/${selectedMemberId}/missing-attributes`,
    ).catch(() => null);
    if (!res?.ok) {
      toast.error("Could not check this environment's questions. Try again.");
      return;
    }
    const { missing, answers } = (await res.json()).data;
    if (missing.length === 0) {
      setSelectedEnvironmentId(environmentId);
      return;
    }
    const initialValues: Record<string, unknown> = {};
    for (const answer of answers) {
      try {
        initialValues[answer.definition.name] = JSON.parse(answer.value);
      } catch {
        initialValues[answer.definition.name] = answer.value;
      }
    }
    setPendingQuestions({ environmentId, definitions: missing, initialValues });
  }

  async function submitAnswers(values: Record<string, unknown>) {
    if (!pendingQuestions || !selectedMemberId) return;
    const { environmentId } = pendingQuestions;
    for (const [key, value] of Object.entries(values)) {
      const res = await fetch(`/api/members/${selectedMemberId}/attributes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environmentId, key, value }),
      }).catch(() => null);
      if (!res?.ok) {
        toast.error("Could not save your answers. Try again.");
        return;
      }
    }
    setPendingQuestions(null);
    setSelectedEnvironmentId(environmentId);
  }

  async function join(environmentId: string) {
    if (!selectedMemberId) return;
    const res = await fetch(`/api/environments/${environmentId}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: selectedMemberId }),
    });
    if (!res.ok) return;
    await loadMemberLists();
    await enterEnvironment(environmentId);
  }

  return (
    <>
      <EnvironmentSwitcher
        activeEnvironment={selectedEnvironment ? toSummary(selectedEnvironment) : null}
        myEnvironments={myEnvironments}
        joinable={joinableList}
        onSelect={(environmentId) =>
          isMember ? enterEnvironment(environmentId) : setSelectedEnvironmentId(environmentId)
        }
        onJoin={join}
      />
      {pendingQuestions &&
        createPortal(
          <AttributePromptModal
            definitions={pendingQuestions.definitions}
            initialValues={pendingQuestions.initialValues}
            onSubmit={submitAnswers}
            onCancel={() => setPendingQuestions(null)}
          />,
          document.body,
        )}
    </>
  );
}
