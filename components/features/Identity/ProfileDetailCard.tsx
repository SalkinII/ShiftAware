"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { humanize } from "@/lib/utils/humanize";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { useToast } from "@/components/ui/Toast";
import { ExperienceLevel, Role } from "@prisma/client";

interface ProfileMember {
  id?: string;
  alias: string;
  avatarId?: string;
  experienceLevel?: string;
  capabilities?: string[];
  attributes?: { name: string; value: string }[];
}

interface AttributeDefinition {
  id: string;
  name: string;
  label: string;
  type: "BOOLEAN" | "SELECT" | "MULTISELECT" | "TEXT";
  required: boolean;
  options?: string[];
}

interface ProfileDetailCardProps {
  member: ProfileMember | null;
  onClose: () => void;
  editable?: boolean;
  onUpdate?: (updates: Partial<ProfileMember>) => Promise<void>;
  eventId?: string;
  attributeDefinitions?: AttributeDefinition[];
}

const expBadgeColor = (level: string) => {
  switch (level) {
    case "SENIOR":
      return "bg-primary-100 text-primary-700";
    case "INTERMEDIATE":
      return "bg-accent-50 text-accent-700";
    case "JUNIOR":
      return "bg-success-50 text-success-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const EXPERIENCE_LEVELS: { value: string; label: string }[] = [
  { value: "JUNIOR", label: "Junior" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "SENIOR", label: "Senior" },
];

const ROLE_OPTIONS: Role[] = ["TEAM_MEMBER", "ADMIN"];

function AttributeList({ attributes }: { attributes: { name: string; value: string }[] }) {
  return (
    <div className="space-y-1">
      {attributes.map((attr) => (
        <div
          key={attr.name}
          className="flex justify-between items-center px-3 py-1.5 bg-gray-50 rounded-lg"
        >
          <span className="text-xs font-medium text-gray-600">
            {humanize(attr.name)}
          </span>
          <span className="text-xs font-bold text-gray-900">{attr.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ProfileDetailCard({
  member,
  onClose,
  editable = false,
  onUpdate,
  eventId,
  attributeDefinitions = [],
}: ProfileDetailCardProps) {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileMember | null>(null);
  const [attributeValues, setAttributeValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!member) return;
    setDraft(member);
    const attrs: Record<string, unknown> = {};
    for (const a of member.attributes || []) {
      try {
        const v = typeof a.value === "string" ? JSON.parse(a.value) : a.value;
        attrs[a.name] = v;
      } catch {
        attrs[a.name] = a.value;
      }
    }
    setAttributeValues(attrs);
  }, [member]);

  useEffect(() => {
    if (!member) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isEditing) setIsEditing(false);
        else onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [member, isEditing, onClose]);

  if (!member) return null;

  async function handleSave() {
    if (!draft?.id || !onUpdate) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/members/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          alias: draft.alias,
          avatarId: draft.avatarId || "👤",
          experienceLevel: draft.experienceLevel || "INTERMEDIATE",
          capabilities: draft.capabilities?.length ? draft.capabilities : ["TEAM_MEMBER"],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || data.error || "Failed to update member");
        return;
      }
      if (eventId && attributeDefinitions.length > 0) {
        for (const attr of attributeDefinitions) {
          const val = attributeValues[attr.name];
          if (val === undefined) continue;
          const attrRes = await fetch(`/api/members/${draft.id}/attributes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId, key: attr.name, value: val }),
          });
          if (!attrRes.ok) {
            const err = await attrRes.json().catch(() => ({}));
            toast.error(err.message || "Failed to save attributes");
            return;
          }
        }
      }
      await onUpdate(draft);
      setIsEditing(false);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  const displayMember = isEditing ? draft : member;
  if (!displayMember) return null;

  return (
    <div
      data-testid="profile-card-backdrop"
      className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-8 max-w-xs w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3 mb-6">
          {isEditing && draft ? (
            <EmojiPicker
              label="Avatar"
              value={draft.avatarId || "👤"}
              onChange={(emoji) => setDraft({ ...draft, avatarId: emoji })}
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center text-5xl shadow-inner border border-gray-100">
              {displayMember.avatarId || "👤"}
            </div>
          )}
          {isEditing && draft ? (
            <Input
              value={draft.alias}
              onChange={(e) => setDraft({ ...draft, alias: e.target.value })}
              placeholder="Alias"
              className="text-center text-lg font-bold"
            />
          ) : (
            <h2 className="text-2xl font-black text-gray-900">
              {displayMember.alias}
            </h2>
          )}
        </div>

        {/* Experience Level */}
        {displayMember.experienceLevel && (
          <div className="mb-4 flex justify-center">
            {isEditing && draft ? (
              <select
                value={draft.experienceLevel}
                onChange={(e) =>
                  setDraft({ ...draft, experienceLevel: e.target.value })
                }
                className="px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-gray-200"
              >
                {EXPERIENCE_LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            ) : (
              <span
                className={cn(
                  "text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full",
                  expBadgeColor(displayMember.experienceLevel),
                )}
              >
                {displayMember.experienceLevel}
              </span>
            )}
          </div>
        )}

        {/* Capabilities */}
        {displayMember.capabilities && displayMember.capabilities.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5 justify-center">
            {isEditing && draft ? (
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((r) => (
                  <label key={r} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={draft.capabilities?.includes(r) ?? false}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...(draft.capabilities || []), r]
                          : (draft.capabilities || []).filter((c) => c !== r);
                        setDraft({ ...draft, capabilities: next });
                      }}
                      className="rounded border-gray-300"
                    />
                    {r.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
            ) : (
              displayMember.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="text-xs font-bold bg-gray-50 text-gray-600 px-2 py-1 rounded-lg border border-gray-100"
                >
                  {cap.replace(/_/g, " ")}
                </span>
              ))
            )}
          </div>
        )}

        {/* Attributes */}
        {isEditing && attributeDefinitions.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400 text-center">
              Attributes
            </p>
            <div className="space-y-3">
              {attributeDefinitions.map((attr) => (
                <div key={attr.id}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {attr.label}
                    {attr.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>
                  {attr.type === "BOOLEAN" && (
                    <input
                      type="checkbox"
                      checked={(attributeValues[attr.name] as boolean) || false}
                      onChange={(e) =>
                        setAttributeValues((prev) => ({
                          ...prev,
                          [attr.name]: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 rounded border-gray-300"
                    />
                  )}
                  {attr.type === "TEXT" && (
                    <Input
                      value={(attributeValues[attr.name] as string) || ""}
                      onChange={(e) =>
                        setAttributeValues((prev) => ({
                          ...prev,
                          [attr.name]: e.target.value,
                        }))
                      }
                      className="text-sm"
                    />
                  )}
                  {(attr.type === "SELECT" || attr.type === "MULTISELECT") && (
                    <select
                      value={
                        Array.isArray(attributeValues[attr.name])
                          ? (attributeValues[attr.name] as string[])[0]
                          : (attributeValues[attr.name] as string) || ""
                      }
                      onChange={(e) =>
                        setAttributeValues((prev) => ({
                          ...prev,
                          [attr.name]: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    >
                      <option value="">Select...</option>
                      {(attr.options || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          displayMember.attributes &&
          displayMember.attributes.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400 text-center">
                Attributes
              </p>
              <AttributeList attributes={displayMember.attributes} />
            </div>
          )
        )}

        {/* Actions */}
        {editable && draft?.id && (
          <div className="mt-6 flex gap-2 justify-center">
            {isEditing ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>Edit</Button>
            )}
          </div>
        )}

        {/* Close hint */}
        {!isEditing && (
          <p className="text-xs text-gray-400 text-center mt-6">
            Click outside or press Esc to close
          </p>
        )}
      </div>
    </div>
  );
}
