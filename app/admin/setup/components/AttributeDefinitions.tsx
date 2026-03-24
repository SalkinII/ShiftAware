"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit, Save, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useEventContext } from "@/lib/hooks/useEventContext";
import { unwrapApiResponse } from "@/lib/api-errors";

interface AttributeDefinition {
  id: string;
  name: string;
  label: string;
  type: "BOOLEAN" | "SELECT" | "MULTISELECT" | "TEXT";
  options: string[];
  required: boolean;
}

export function AttributeDefinitions() {
  const toast = useToast();
  const { selectedEventId, selectedEvent } = useEventContext(true);
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    label: "",
    type: "BOOLEAN" as "BOOLEAN" | "SELECT" | "MULTISELECT" | "TEXT",
    options: [] as string[],
    required: false,
  });
  const [optionsInput, setOptionsInput] = useState("");

  useEffect(() => {
    if (selectedEventId) {
      loadAttributes();
    } else {
      setAttributes([]);
    }
  }, [selectedEventId]);

  async function loadAttributes() {
    try {
      const res = await fetch(`/api/events/${selectedEventId}/attributes`);
      if (res.ok) {
        const data = await res.json();
        setAttributes(unwrapApiResponse<AttributeDefinition[]>(data) || []);
      }
    } catch (error) {
      console.error("Failed to load attributes:", error);
    }
  }

  function handleStartEdit(attr: AttributeDefinition) {
    setEditingId(attr.id);
    setFormData({
      name: attr.name,
      label: attr.label,
      type: attr.type,
      options: attr.options,
      required: attr.required,
    });
    setOptionsInput(attr.options.join(", "));
  }

  function handleStartNew() {
    setEditingId("new");
    setFormData({
      name: "",
      label: "",
      type: "BOOLEAN",
      options: [],
      required: false,
    });
    setOptionsInput("");
  }

  function handleCancel() {
    setEditingId(null);
    setFormData({
      name: "",
      label: "",
      type: "BOOLEAN",
      options: [],
      required: false,
    });
    setOptionsInput("");
  }

  async function handleSave() {
    if (!formData.name || !formData.label) {
      toast.error("Name and label are required");
      return;
    }

    // Parse options from input - split, trim, filter empty
    const options = optionsInput
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0);

    const payload = { ...formData, options };

    try {
      const url =
        editingId === "new"
          ? `/api/events/${selectedEventId}/attributes`
          : `/api/events/${selectedEventId}/attributes/${editingId}`;

      const method = editingId === "new" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(
          editingId === "new" ? "Attribute created" : "Attribute updated",
        );
        loadAttributes();
        handleCancel();
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to save attribute");
      }
    } catch {
      toast.error("Failed to save attribute");
    }
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        "Delete this attribute? This will remove it from all team members.",
      )
    ) {
      return;
    }

    try {
      const res = await fetch(
        `/api/events/${selectedEventId}/attributes/${id}`,
        {
          method: "DELETE",
        },
      );

      if (res.ok) {
        toast.success("Attribute deleted");
        loadAttributes();
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to delete attribute");
      }
    } catch {
      toast.error("Failed to delete attribute");
    }
  }

  if (!selectedEventId) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-amber-600">
          Select an event from the header to manage attributes.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Team Attributes
          </h3>
          <p className="text-sm text-gray-500">
            Define custom attributes for team members for this event
          </p>
        </div>
        {selectedEvent && (
          <span className="text-sm font-bold text-gray-700 bg-gray-50 px-4 py-2 rounded-lg">
            {selectedEvent.name}
          </span>
        )}
      </div>

      {!editingId && (
        <Button onClick={handleStartNew}>
          <Plus className="w-4 h-4 mr-2" />
          Add Attribute
        </Button>
      )}

      {editingId && (
        <Card className="p-6 bg-gray-50">
          <h4 className="text-md font-bold text-gray-900 mb-4">
            {editingId === "new" ? "New Attribute" : "Edit Attribute"}
          </h4>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Internal Name"
                placeholder="e.g., can_drive"
                value={formData.name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    name: e.target.value.toLowerCase().replace(/\s/g, "_"),
                  })
                }
              />
              <Input
                label="Display Label"
                placeholder="e.g., Can Drive"
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as any })
                }
              >
                <option value="BOOLEAN">Boolean (Yes/No)</option>
                <option value="SELECT">Single Select</option>
                <option value="MULTISELECT">Multi Select</option>
                <option value="TEXT">Free Text</option>
              </Select>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="required"
                  checked={formData.required}
                  onChange={(e) =>
                    setFormData({ ...formData, required: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <label
                  htmlFor="required"
                  className="text-sm font-medium text-gray-700"
                >
                  Required
                </label>
              </div>
            </div>
            {(formData.type === "SELECT" ||
              formData.type === "MULTISELECT") && (
              <Input
                label="Options (comma-separated)"
                placeholder="e.g., Morning, Afternoon, Evening"
                value={optionsInput}
                onChange={(e) => setOptionsInput(e.target.value)}
              />
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={handleCancel}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-1" /> Save
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {attributes.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-500">No attributes defined yet.</p>
          </Card>
        ) : (
          attributes.map((attr) => (
            <Card
              key={attr.id}
              className="p-4 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-gray-900">{attr.label}</span>
                  {attr.required && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded font-bold">
                      REQUIRED
                    </span>
                  )}
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {attr.type}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                    {attr.name}
                  </code>
                  {attr.options.length > 0 && (
                    <span className="ml-2">• {attr.options.join(", ")}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStartEdit(attr)}
                  disabled={!!editingId}
                >
                  <Edit className="w-4 h-4 text-primary-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(attr.id)}
                  disabled={!!editingId}
                >
                  <Trash2 className="w-4 h-4 text-error-600" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
