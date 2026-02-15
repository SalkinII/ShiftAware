"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { AttributeDefinitionLike } from "@/lib/utils/attribute-check";

interface AttributePromptModalProps {
  definitions: AttributeDefinitionLike[];
  initialValues?: Record<string, unknown>;
  onSubmit: (attributes: Record<string, unknown>) => void | Promise<void>;
  onCancel?: () => void;
}

export function AttributePromptModal({
  definitions,
  initialValues = {},
  onSubmit,
  onCancel,
}: AttributePromptModalProps) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [saving, setSaving] = useState(false);

  const handleChange = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Complete Your Profile
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Please fill in the required attributes for this event.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {definitions.map((attr) => (
            <div key={attr.id}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {attr.label}
                {attr.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {attr.type === "BOOLEAN" && (
                <input
                  type="checkbox"
                  checked={(values[attr.name] as boolean) ?? false}
                  onChange={(e) => handleChange(attr.name, e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
              )}
              {attr.type === "TEXT" && (
                <Input
                  value={(values[attr.name] as string) ?? ""}
                  onChange={(e) => handleChange(attr.name, e.target.value)}
                  required={attr.required}
                />
              )}
              {attr.type === "SELECT" && (
                <select
                  value={(values[attr.name] as string) ?? ""}
                  onChange={(e) => handleChange(attr.name, e.target.value)}
                  required={attr.required}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select...</option>
                  {attr.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}
              {attr.type === "MULTISELECT" && (
                <div className="space-y-2">
                  {attr.options?.map((opt) => (
                    <label key={opt} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={(
                          (values[attr.name] as string[]) || []
                        ).includes(opt)}
                        onChange={(e) => {
                          const current = (values[attr.name] as string[]) || [];
                          const updated = e.target.checked
                            ? [...current, opt]
                            : current.filter((v) => v !== opt);
                          handleChange(attr.name, updated);
                        }}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-3 pt-4">
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                className="flex-1"
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={saving}
            >
              {saving ? "Saving..." : "Continue"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
