"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { AttributeDefinitionLike } from "@/lib/utils/attribute-check";
import { AttributeValueField } from "./AttributeValueField";

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
              <AttributeValueField
                attr={attr as any}
                value={values[attr.name]}
                onChange={(v) => handleChange(attr.name, v)}
              />
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
