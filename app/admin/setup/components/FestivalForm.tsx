"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { unwrapApiResponse } from "@/lib/api-errors";

interface FestivalListItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface FestivalFields {
  name: string;
  startDate: string;
  endDate: string;
}

interface FestivalFormProps {
  selectedFestivalId: string | null;
  onSelect: (id: string) => void;
}

const emptyFields: FestivalFields = { name: "", startDate: "", endDate: "" };

async function fetchFestivals(): Promise<FestivalListItem[]> {
  const res = await fetch("/api/festivals");
  if (!res.ok) return [];
  return unwrapApiResponse<FestivalListItem[]>(await res.json()) ?? [];
}

async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return body.message ?? body.error ?? "Failed to save festival";
}

export function FestivalForm({ selectedFestivalId, onSelect }: FestivalFormProps) {
  const [festivals, setFestivals] = useState<FestivalListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);

  const refresh = useCallback(async () => {
    setFestivals(await fetchFestivals());
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!loaded) return <div className="text-gray-500">Loading festivals...</div>;

  const selected = festivals.find((festival) => festival.id === selectedFestivalId) ?? null;

  if (festivals.length === 0 || creatingNew) {
    return (
      <FestivalCreateForm
        isFirst={festivals.length === 0}
        onCancel={festivals.length === 0 ? undefined : () => setCreatingNew(false)}
        onCreated={async (id) => {
          await refresh();
          setCreatingNew(false);
          onSelect(id);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] space-y-1">
          <label htmlFor="festival-select" className="block text-sm font-semibold text-gray-700">
            Festival
          </label>
          <select
            id="festival-select"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900"
            value={selectedFestivalId ?? ""}
            onChange={(e) => {
              if (e.target.value) onSelect(e.target.value);
            }}
          >
            <option value="">Choose a festival</option>
            {festivals.map((festival) => (
              <option key={festival.id} value={festival.id}>
                {festival.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => setCreatingNew(true)}>
          + New festival
        </Button>
      </div>

      {selected && <FestivalEditForm key={selected.id} festival={selected} onSaved={refresh} />}
    </div>
  );
}

function FestivalCreateForm({
  isFirst,
  onCreated,
  onCancel,
}: {
  isFirst: boolean;
  onCreated: (id: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [fields, setFields] = useState<FestivalFields>(emptyFields);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/festivals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        const created = unwrapApiResponse<{ id: string }>(await res.json());
        await onCreated(created.id);
      } else {
        setError(await readError(res));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">
        {isFirst ? "Create your first festival" : "New festival"}
      </h2>
      <Input
        label="Festival name"
        placeholder="e.g., Starlight Meadow Festival 2026"
        value={fields.name}
        onChange={(e) => setFields({ ...fields, name: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Start date"
          type="date"
          value={fields.startDate}
          onChange={(e) => setFields({ ...fields, startDate: e.target.value })}
        />
        <Input
          label="End date"
          type="date"
          value={fields.endDate}
          onChange={(e) => setFields({ ...fields, endDate: e.target.value })}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-error-600">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={saving}>
          Create festival
        </Button>
      </div>
    </form>
  );
}

function FestivalEditForm({
  festival,
  onSaved,
}: {
  festival: FestivalListItem;
  onSaved: () => Promise<void>;
}) {
  const [fields, setFields] = useState<FestivalFields>({
    name: festival.name,
    startDate: festival.startDate.slice(0, 10),
    endDate: festival.endDate.slice(0, 10),
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/festivals/${festival.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        await onSaved();
      } else {
        setError(await readError(res));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Festival name"
        value={fields.name}
        onChange={(e) => setFields({ ...fields, name: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Start date"
          type="date"
          value={fields.startDate}
          onChange={(e) => setFields({ ...fields, startDate: e.target.value })}
        />
        <Input
          label="End date"
          type="date"
          value={fields.endDate}
          onChange={(e) => setFields({ ...fields, endDate: e.target.value })}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-error-600">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          Save festival
        </Button>
      </div>
    </form>
  );
}
