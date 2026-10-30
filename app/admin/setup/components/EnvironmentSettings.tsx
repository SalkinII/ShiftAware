"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useEnvironmentContext } from "@/lib/contexts/EnvironmentContext";
import { unwrapApiResponse } from "@/lib/api-errors";

export function EnvironmentSettings({ festivalId }: { festivalId: string }) {
  const toast = useToast();
  const {
    selectedEnvironmentId,
    selectedEnvironment,
    environments: allEnvironments,
    loading,
    refreshEnvironments,
    setSelectedEnvironmentId,
  } = useEnvironmentContext();
  const environments = useMemo(
    () => allEnvironments.filter((environment) => environment.festivalId === festivalId),
    [allEnvironments, festivalId],
  );
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteEnvironmentDialog, setDeleteEnvironmentDialog] = useState<{
    isOpen: boolean;
    isLoading: boolean;
  }>({
    isOpen: false,
    isLoading: false,
  });

  const [formData, setFormData] = useState({
    name: "",
    status: "PLANNING",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    if (isCreatingNew || !selectedEnvironmentId) {
      setFormData({
        name: "",
        status: "PLANNING",
        startDate: "",
        endDate: "",
      });
    } else {
      const environment = environments.find((e) => e.id === selectedEnvironmentId);
      if (environment) {
        setFormData({
          name: environment.name,
          status: environment.status,
          startDate: environment.startDate.split("T")[0],
          endDate: environment.endDate.split("T")[0],
        });
      }
    }
  }, [selectedEnvironmentId, environments, isCreatingNew]);

  async function handleSave() {
    if (!formData.name || !formData.startDate || !formData.endDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        startDate: formData.startDate,
        endDate: formData.endDate,
        ...(isCreatingNew ? { festivalId } : {}),
      };

      const url = isCreatingNew
        ? "/api/environments"
        : `/api/environments/${selectedEnvironmentId}`;

      const method = isCreatingNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const resData = await res.json();
        const result = unwrapApiResponse<{ id: string }>(resData);
        toast.success(isCreatingNew ? "Environment created" : "Environment updated");
        await refreshEnvironments();
        if (isCreatingNew) {
          const newId = result?.id;
          if (newId) setSelectedEnvironmentId(newId);
          setIsCreatingNew(false);
        }
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to save environment");
      }
    } catch {
      toast.error("Failed to save environment");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEnvironment() {
    setDeleteEnvironmentDialog({ isOpen: true, isLoading: false });
  }

  async function confirmDeleteEnvironment() {
    if (!selectedEnvironmentId) return;

    setDeleteEnvironmentDialog((prev) => ({ ...prev, isLoading: true }));

    try {
      const res = await fetch(`/api/environments/${selectedEnvironmentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Environment deleted");
        localStorage.removeItem("adminSelectedEnvironmentId");
        setSelectedEnvironmentId("");
        await refreshEnvironments();
        setDeleteEnvironmentDialog({ isOpen: false, isLoading: false });
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to delete environment");
        setDeleteEnvironmentDialog((prev) => ({ ...prev, isLoading: false }));
      }
    } catch {
      toast.error("Failed to delete environment. Please try again.");
      setDeleteEnvironmentDialog((prev) => ({ ...prev, isLoading: false }));
    }
  }

  if (loading) {
    return <div className="text-gray-500">Loading events...</div>;
  }

  return (
    <>
      <ConfirmDialog
        isOpen={deleteEnvironmentDialog.isOpen}
        onClose={() => {
          if (!deleteEnvironmentDialog.isLoading) {
            setDeleteEnvironmentDialog({ isOpen: false, isLoading: false });
          }
        }}
        onConfirm={confirmDeleteEnvironment}
        title="Delete Environment"
        message={`This will permanently delete "${selectedEnvironment?.name}" along with all its shifts, assignments, preferences, and registrations. This cannot be undone.`}
        confirmText="Delete Environment"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deleteEnvironmentDialog.isLoading}
      />
      <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          Environment Configuration
        </h3>
        <p className="text-sm text-gray-500">
          Create a new environment or select an existing one to edit
        </p>
      </div>

      <div className="mb-6 flex items-center justify-between">
        {selectedEnvironmentId && !isCreatingNew ? (
          <h2 className="text-lg font-semibold text-gray-900">
            Editing: {selectedEnvironment?.name || "Loading..."}
          </h2>
        ) : !isCreatingNew ? (
          <p className="text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
            Select an environment from the header, or create a new one
          </p>
        ) : (
          <h2 className="text-lg font-semibold text-gray-900">
            Create New Environment
          </h2>
        )}
        <button
          type="button"
          onClick={() => setIsCreatingNew(!isCreatingNew)}
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          {isCreatingNew ? "Cancel" : "+ New Environment"}
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Environment Name"
            placeholder="e.g., Summer Festival 2026"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-700">
              Status
            </label>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-lg">
              <span className="text-sm font-medium text-gray-900 capitalize">
                {formData.status?.replace(/_/g, " ").toLowerCase() ||
                  "Planning"}
              </span>
          </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start Date"
            type="date"
            value={formData.startDate}
            onChange={(e) =>
              setFormData({ ...formData, startDate: e.target.value })
            }
            required
          />
          <Input
            label="End Date"
            type="date"
            value={formData.endDate}
            onChange={(e) =>
              setFormData({ ...formData, endDate: e.target.value })
            }
            required
          />
        </div>
      </div>

      <div className="flex justify-between pt-4">
        {!isCreatingNew &&
          selectedEnvironmentId &&
          (selectedEnvironment?.status === "PLANNING" ||
            selectedEnvironment?.status === "COMPLETED") && (
            <Button
              variant="destructive"
              onClick={handleDeleteEnvironment}
              disabled={saving || deleteEnvironmentDialog.isLoading}
            >
              Delete Environment
            </Button>
          )}
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? "Saving..."
              : selectedEnvironmentId === "new"
                ? "Create Environment"
                : "Update Environment"}
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}
