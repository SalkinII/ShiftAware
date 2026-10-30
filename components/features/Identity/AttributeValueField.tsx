"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { format } from "date-fns";
import type { TimeConstraintValue } from "@/lib/algorithm/time-constraint";

export function toDatetimeLocalValue(isoUtc: string): string {
  const date = new Date(isoUtc);
  const localMs = date.getTime() - date.getTimezoneOffset() * 60000;
  return new Date(localMs).toISOString().slice(0, 16);
}

export function fromDatetimeLocalValue(localValue: string): string {
  return new Date(localValue).toISOString();
}

interface AttrLike {
  name: string;
  label: string;
  type: "BOOLEAN" | "SELECT" | "MULTISELECT" | "TEXT" | "TIME_CONSTRAINT";
  options?: string[] | null;
  required?: boolean;
}

interface AttributeValueFieldProps {
  attr: AttrLike;
  value: unknown;
  onChange?: (value: unknown) => void;
  readOnly?: boolean;
}

function parseTimeConstraint(value: unknown): TimeConstraintValue {
  if (typeof value !== "string" || !value) return { availabilityWindows: [], dailyBlackouts: [] };
  try {
    const parsed = JSON.parse(value);
    return {
      availabilityWindows: parsed.availabilityWindows ?? [],
      dailyBlackouts: parsed.dailyBlackouts ?? [],
    };
  } catch {
    return { availabilityWindows: [], dailyBlackouts: [] };
  }
}

function TimeConstraintDisplay({ value }: { value: unknown }) {
  const parsed = parseTimeConstraint(value);
  if (parsed.availabilityWindows.length === 0 && parsed.dailyBlackouts.length === 0) {
    return <span className="text-sm text-gray-500">No constraints set</span>;
  }
  const fmt = (iso: string) => format(new Date(iso), "EEE HH:mm");
  return (
    <div className="text-sm text-gray-700 space-y-1">
      {parsed.availabilityWindows.map((w, i) => (
        <div key={i}>Available {fmt(w.arriveAfter)} – {fmt(w.leaveBefore)}</div>
      ))}
      {parsed.dailyBlackouts.map((b, i) => (
        <div key={i}>
          Blackout {format(new Date(`${b.date}T00:00:00Z`), "MMM d")}:{" "}
          {String(b.startHour).padStart(2, "0")}:00–{String(b.endHour).padStart(2, "0")}:00
        </div>
      ))}
    </div>
  );
}

function TimeConstraintEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const parsed = parseTimeConstraint(value);
  const [confirmedRow, setConfirmedRow] = useState<string | null>(null);

  function emit(next: TimeConstraintValue) {
    onChange(JSON.stringify(next));
  }

  function confirmRow(key: string) {
    setConfirmedRow(key);
    setTimeout(() => setConfirmedRow((current) => (current === key ? null : current)), 1200);
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-medium text-gray-500 mb-1">Availability windows</div>
        {parsed.availabilityWindows.map((w, i) => (
          <div key={i} className="flex flex-wrap gap-2 mb-1 items-center">
            <Input
              type="datetime-local"
              className="min-w-0 flex-1"
              value={toDatetimeLocalValue(w.arriveAfter)}
              onChange={(e) => {
                const next = { ...parsed, availabilityWindows: [...parsed.availabilityWindows] };
                next.availabilityWindows[i] = { ...w, arriveAfter: fromDatetimeLocalValue(e.target.value) };
                emit(next);
                confirmRow(`w${i}`);
              }}
            />
            <Input
              type="datetime-local"
              className="min-w-0 flex-1"
              value={toDatetimeLocalValue(w.leaveBefore)}
              onChange={(e) => {
                const next = { ...parsed, availabilityWindows: [...parsed.availabilityWindows] };
                next.availabilityWindows[i] = { ...w, leaveBefore: fromDatetimeLocalValue(e.target.value) };
                emit(next);
                confirmRow(`w${i}`);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex-shrink-0"
              onClick={() =>
                emit({ ...parsed, availabilityWindows: parsed.availabilityWindows.filter((_, j) => j !== i) })
              }
            >
              Remove
            </Button>
            {confirmedRow === `w${i}` && (
              <span className="text-success-600 text-xs flex-shrink-0" role="status">✓ Saved</span>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            emit({
              ...parsed,
              availabilityWindows: [
                ...parsed.availabilityWindows,
                { arriveAfter: new Date().toISOString(), leaveBefore: new Date().toISOString() },
              ],
            })
          }
        >
          Add availability window
        </Button>
      </div>

      <div>
        <div className="text-xs font-medium text-gray-500 mb-1">Daily blackouts</div>
        {parsed.dailyBlackouts.map((b, i) => (
          <div key={i} className="flex flex-wrap gap-2 mb-1 items-center">
            <Input
              type="date"
              className="min-w-0 flex-1"
              value={b.date}
              onChange={(e) => {
                const next = { ...parsed, dailyBlackouts: [...parsed.dailyBlackouts] };
                next.dailyBlackouts[i] = { ...b, date: e.target.value };
                emit(next);
                confirmRow(`b${i}`);
              }}
            />
            <Input
              type="number"
              min={0}
              max={23}
              className="w-20 flex-shrink-0"
              value={b.startHour}
              onChange={(e) => {
                const next = { ...parsed, dailyBlackouts: [...parsed.dailyBlackouts] };
                next.dailyBlackouts[i] = { ...b, startHour: Number(e.target.value) };
                emit(next);
                confirmRow(`b${i}`);
              }}
            />
            <Input
              type="number"
              min={0}
              max={23}
              className="w-20 flex-shrink-0"
              value={b.endHour}
              onChange={(e) => {
                const next = { ...parsed, dailyBlackouts: [...parsed.dailyBlackouts] };
                next.dailyBlackouts[i] = { ...b, endHour: Number(e.target.value) };
                emit(next);
                confirmRow(`b${i}`);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex-shrink-0"
              onClick={() => emit({ ...parsed, dailyBlackouts: parsed.dailyBlackouts.filter((_, j) => j !== i) })}
            >
              Remove
            </Button>
            {confirmedRow === `b${i}` && (
              <span className="text-success-600 text-xs flex-shrink-0" role="status">✓ Saved</span>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            emit({
              ...parsed,
              dailyBlackouts: [
                ...parsed.dailyBlackouts,
                { date: new Date().toISOString().slice(0, 10), startHour: 22, endHour: 6 },
              ],
            })
          }
        >
          Add blackout
        </Button>
      </div>
    </div>
  );
}

export function AttributeValueField({ attr, value, onChange, readOnly }: AttributeValueFieldProps) {
  if (attr.type === "TIME_CONSTRAINT") {
    return readOnly ? <TimeConstraintDisplay value={value} /> : <TimeConstraintEditor value={value} onChange={onChange!} />;
  }

  if (readOnly) {
    if (attr.type === "MULTISELECT") return <span className="text-sm text-gray-700">{((value as string[]) ?? []).join(", ") || "—"}</span>;
    if (attr.type === "BOOLEAN") return <span className="text-sm text-gray-700">{value ? "Yes" : "No"}</span>;
    return <span className="text-sm text-gray-700">{(value as string) || "—"}</span>;
  }

  if (attr.type === "BOOLEAN") {
    return (
      <input
        type="checkbox"
        checked={(value as boolean) ?? false}
        onChange={(e) => onChange!(e.target.checked)}
        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
      />
    );
  }

  if (attr.type === "TEXT") {
    return <Input value={(value as string) ?? ""} onChange={(e) => onChange!(e.target.value)} required={attr.required} />;
  }

  if (attr.type === "SELECT") {
    return (
      <select
        value={(value as string) ?? ""}
        onChange={(e) => onChange!(e.target.value)}
        required={attr.required}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option value="">Select...</option>
        {attr.options?.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  // MULTISELECT
  return (
    <div className="space-y-2">
      {attr.options?.map((opt) => (
        <label key={opt} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={((value as string[]) || []).includes(opt)}
            onChange={(e) => {
              const current = (value as string[]) || [];
              onChange!(e.target.checked ? [...current, opt] : current.filter((v) => v !== opt));
            }}
            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
          <span className="text-sm">{opt}</span>
        </label>
      ))}
    </div>
  );
}
