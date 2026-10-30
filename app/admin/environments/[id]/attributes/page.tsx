"use client";

import { use, useCallback, useEffect, useState, type FormEvent } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { unwrapApiResponse } from "@/lib/api-errors";

interface EnvironmentInfo {
  id: string;
  name: string;
  festivalId: string;
}

interface LibraryQuestion {
  id: string;
  name: string;
  label: string;
  type: string;
  usedBy: string[];
  answeredCount: number;
}

interface RequirementRow {
  id: string;
  required: boolean;
}

const QUESTION_TYPES = ["BOOLEAN", "SELECT", "MULTISELECT", "TEXT", "TIME_CONSTRAINT"];

const emptyDraft = { name: "", label: "", type: "BOOLEAN", options: "" };

export default function EnvironmentAttributesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: environmentId } = use(params);
  const [environment, setEnvironment] = useState<EnvironmentInfo | null>(null);
  const [library, setLibrary] = useState<LibraryQuestion[]>([]);
  const [requirements, setRequirements] = useState<RequirementRow[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState<string | null>(null);

  const loadRequirements = useCallback(async () => {
    const res = await fetch(`/api/environments/${environmentId}/attribute-requirements`);
    if (res.ok) setRequirements(unwrapApiResponse<RequirementRow[]>(await res.json()) ?? []);
  }, [environmentId]);

  const loadLibrary = useCallback(async (festivalId: string) => {
    const res = await fetch(`/api/festivals/${festivalId}/attribute-definitions`);
    if (res.ok) setLibrary(unwrapApiResponse<LibraryQuestion[]>(await res.json()) ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const envRes = await fetch(`/api/environments/${environmentId}`);
      if (!envRes.ok) {
        setError("Environment not found");
        return;
      }
      const info = unwrapApiResponse<EnvironmentInfo>(await envRes.json());
      setEnvironment(info);
      await Promise.all([loadRequirements(), loadLibrary(info.festivalId)]);

      const membersRes = await fetch("/api/members");
      if (membersRes.ok) {
        setMemberCount((unwrapApiResponse<unknown[]>(await membersRes.json()) ?? []).length);
      }
    })();
  }, [environmentId, loadRequirements, loadLibrary]);

  const requirementFor = (questionId: string) => requirements.find((r) => r.id === questionId);

  async function saveRequirement(definitionId: string, required: boolean) {
    const res = await fetch(`/api/environments/${environmentId}/attribute-requirements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ definitionId, required }),
    });
    if (!res.ok) {
      setError("Could not save the question for this environment");
      return;
    }
    setError(null);
    await loadRequirements();
  }

  async function removeRequirement(definitionId: string) {
    const res = await fetch(`/api/environments/${environmentId}/attribute-requirements`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ definitionId }),
    });
    if (!res.ok) {
      setError("Could not remove the question from this environment");
      return;
    }
    setError(null);
    await loadRequirements();
  }

  async function addQuestion(e: FormEvent) {
    e.preventDefault();
    if (!environment) return;

    const res = await fetch(`/api/festivals/${environment.festivalId}/attribute-definitions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        label: draft.label,
        type: draft.type,
        options: draft.options.split(",").map((o) => o.trim()).filter(Boolean),
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? body.error ?? "Could not add the question");
      return;
    }

    setDraft(emptyDraft);
    setError(null);
    await loadLibrary(environment.festivalId);
  }

  if (!environment) {
    return <p className="text-gray-500">{error ?? "Loading..."}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Set up {environment.name} — which questions apply?
        </h1>
        <p className="text-sm text-gray-500">
          Pick from the festival question library. Answers are stored once per member and reused.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-error-600">
          {error}
        </p>
      )}

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Festival question library</h2>
        {library.length === 0 && (
          <p className="text-sm text-gray-500">No questions in the library yet.</p>
        )}
        {library.map((question) => {
          const requirement = requirementFor(question.id);
          return (
            <div
              key={question.id}
              className="flex flex-wrap items-center gap-3 border-b border-gray-100 py-2"
            >
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(requirement)}
                  onChange={(e) =>
                    e.target.checked
                      ? saveRequirement(question.id, false)
                      : removeRequirement(question.id)
                  }
                />
                <span className="font-medium text-gray-900">{question.name}</span>
              </label>
              <span className="text-sm text-gray-500">{question.type}</span>
              <span className="text-sm text-gray-500">
                {question.usedBy.length > 0 ? `used by ${question.usedBy.join(", ")}` : "not used yet"}
              </span>
              <span className="text-sm text-gray-500">
                {question.answeredCount}/{memberCount} answered
              </span>
              {requirement && (
                <select
                  aria-label={`${question.name} required`}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                  value={requirement.required ? "required" : "optional"}
                  onChange={(e) => saveRequirement(question.id, e.target.value === "required")}
                >
                  <option value="required">required</option>
                  <option value="optional">optional</option>
                </select>
              )}
            </div>
          );
        })}
      </Card>

      <Card className="p-6">
        <form onSubmit={addQuestion} className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Add a new question to the festival library</h2>
          {/* ponytail: no near-duplicate name warning here yet — add when the library is observed to rot */}
          <Input
            label="Name"
            placeholder="e.g., first_aid"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Input
            label="Label"
            placeholder="e.g., First aid certificate"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
          <div className="space-y-1">
            <label htmlFor="question-type" className="block text-sm font-semibold text-gray-700">
              Type
            </label>
            <select
              id="question-type"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value })}
            >
              {QUESTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Options (comma-separated, for SELECT and MULTISELECT)"
            value={draft.options}
            onChange={(e) => setDraft({ ...draft, options: e.target.value })}
          />
          <div className="flex justify-end">
            <Button type="submit">Add to library</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
