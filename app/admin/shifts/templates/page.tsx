"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Edit2, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useCache } from "@/lib/cache/useCache";
import { ShiftType, ShiftPriority, Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";

// Helper functions for duration conversion
function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface ShiftTemplate {
  id: string;
  name: string;
  type: ShiftType;
  durationMinutes: number;
  startTime: string;
  priority: ShiftPriority;
  desirabilityScore: number;
  capacity: number;
  color?: string;
  requiredRoles: { role: Role; count: number }[];
}

export default function TemplatesPage() {
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    templateId: string | null;
    templateName: string;
    isLoading: boolean;
  }>({
    isOpen: false,
    templateId: null,
    templateName: "",
    isLoading: false,
  });
  const [formData, setFormData] = useState<{
    name: string;
    type: ShiftType;
    duration: string; // HH:MM format for input
    startTime: string;
    priority: ShiftPriority;
    desirabilityScore: number;
    capacity: number;
    color: string;
    requiredRoles: Array<{ role: Role; count: number }>;
  }>({
    name: "",
    type: "MOBILE_TEAM_1",
    duration: "06:00", // 6 hours default
    startTime: "08:00",
    priority: "CORE",
    desirabilityScore: 3,
    capacity: 2,
    color: "",
    requiredRoles: [{ role: "TEAM_MEMBER", count: 1 }],
  });

  const {
    data: templates,
    loading,
    refetch,
  } = useCache<ShiftTemplate[]>({
    key: "shift-templates",
    fetchFn: async () => {
      const res = await fetch("/api/shifts/templates");
      if (!res.ok) {
        let errorMessage = "Failed to fetch templates";
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = `${errorMessage}: ${res.status} ${res.statusText}`;
        }
        throw new Error(errorMessage);
      }
      const data = await res.json();
      // createSuccessResponse wraps data, so unwrap if needed
      return Array.isArray(data) ? data : data.data || data;
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const url = editingId
        ? `/api/shifts/templates/${editingId}`
        : "/api/shifts/templates";
      const method = editingId ? "PUT" : "POST";

      // Convert duration from HH:MM to minutes for API
      const payload = {
        ...formData,
        durationMinutes: hhmmToMinutes(formData.duration),
      };
      // Remove the duration string field (API expects durationMinutes)
      const { duration, ...apiData } = payload;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiData),
      });

      if (res.ok) {
        toast.success(
          editingId
            ? "Template updated successfully"
            : "Template created successfully",
        );
        setShowForm(false);
        setEditingId(null);
        resetForm();
        refetch();
        window.dispatchEvent(
          new CustomEvent("shiftaware:cache-invalidate", {
            detail: { keys: ["shift-templates"] },
          }),
        );
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to save template");
      }
    } catch (error) {
      console.error("Failed to save template:", error);
      toast.error("Failed to save template. Please try again.");
    }
  }

  function resetForm() {
    setFormData({
      name: "",
      type: "MOBILE_TEAM_1" as ShiftType,
      duration: "06:00",
      startTime: "08:00",
      priority: "CORE" as ShiftPriority,
      desirabilityScore: 3,
      capacity: 2,
      color: "",
      requiredRoles: [{ role: "TEAM_MEMBER" as Role, count: 1 }],
    });
  }

  function handleEdit(template: ShiftTemplate) {
    setFormData({
      name: template.name,
      type: template.type,
      duration: minutesToHHMM(template.durationMinutes),
      startTime: template.startTime,
      priority: template.priority,
      desirabilityScore: template.desirabilityScore,
      capacity: template.capacity,
      color: template.color || "",
      requiredRoles: template.requiredRoles,
    });
    setEditingId(template.id);
    setShowForm(true);
  }

  async function handleDelete(templateId: string) {
    const template = templates?.find((t) => t.id === templateId);
    if (!template) return;

    setDeleteDialog({
      isOpen: true,
      templateId,
      templateName: template.name,
      isLoading: false,
    });
  }

  async function confirmDelete() {
    if (!deleteDialog.templateId) return;

    setDeleteDialog((prev) => ({ ...prev, isLoading: true }));

    try {
      const res = await fetch(
        `/api/shifts/templates/${deleteDialog.templateId}`,
        {
          method: "DELETE",
        },
      );

      if (res.ok) {
        toast.success("Template deleted successfully");
        refetch();
        window.dispatchEvent(
          new CustomEvent("shiftaware:cache-invalidate", {
            detail: { keys: ["shift-templates"] },
          }),
        );
        setDeleteDialog({
          isOpen: false,
          templateId: null,
          templateName: "",
          isLoading: false,
        });
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to delete template");
        setDeleteDialog((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast.error("Failed to delete template. Please try again.");
      setDeleteDialog((prev) => ({ ...prev, isLoading: false }));
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" variant="text" />
        <SkeletonList count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Shift Templates</h1>
        <Button
          onClick={() => {
            resetForm();
            setEditingId(null);
            setShowForm(true);
          }}
          variant="primary"
        >
          <Plus className="w-4 h-4" />
          New Template
        </Button>
      </div>

      {showForm && (
        <Card elevation={2}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Template Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                placeholder="e.g., Morning Mobile Team"
              />

              <Select
                label="Shift Type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as ShiftType,
                  })
                }
                required
              >
                <option value="MOBILE_TEAM_1">Mobile Team 1</option>
                <option value="MOBILE_TEAM_2">Mobile Team 2</option>
                <option value="STATIONARY">Stationary</option>
                <option value="EXECUTIVE">Executive</option>
              </Select>

              <Input
                label="Start Time"
                type="time"
                value={formData.startTime}
                onChange={(e) =>
                  setFormData({ ...formData, startTime: e.target.value })
                }
                required
              />

              <Input
                label="Duration (HH:MM)"
                type="time"
                value={formData.duration}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    duration: e.target.value,
                  })
                }
                required
              />

              <Select
                label="Priority"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: e.target.value as ShiftPriority,
                  })
                }
              >
                <option value="CORE">Core</option>
                <option value="BUFFER">Buffer</option>
              </Select>

              <Input
                label="Capacity"
                type="number"
                value={formData.capacity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    capacity: parseInt(e.target.value) || 2,
                  })
                }
                required
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" variant="primary">
                {editingId ? "Update" : "Create"} Template
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates?.map((template) => (
          <Card key={template.id} elevation={1} hover>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{template.name}</h3>
                <p className="text-sm text-gray-500">
                  {template.type.replace("_", " ")}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEdit(template)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(template.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>
                  {template.startTime} •{" "}
                  {formatDuration(template.durationMinutes)}
                </span>
              </div>
              <div>Capacity: {template.capacity}</div>
              <div>Priority: {template.priority}</div>
            </div>
          </Card>
        ))}
      </div>

      {templates?.length === 0 && (
        <Card>
          <p className="text-gray-500 text-center py-8">
            No templates yet. Create your first template to get started.
          </p>
        </Card>
      )}

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() =>
          setDeleteDialog({
            isOpen: false,
            templateId: null,
            templateName: "",
            isLoading: false,
          })
        }
        onConfirm={confirmDelete}
        title="Delete Template"
        message={`Are you sure you want to delete "${deleteDialog.templateName}"?`}
        variant="destructive"
        isLoading={deleteDialog.isLoading}
      />
    </div>
  );
}
