"use client";

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Save, X, Clock, Users, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

import { useToast } from "@/components/ui/Toast";
import { unwrapApiResponse } from "@/lib/api-errors";
import { useEventContext } from "@/lib/hooks/useEventContext";
import { cn } from "@/lib/utils";

interface ShiftTemplate {
  id: string;
  name: string;
  type: string;
  durationMinutes: number;
  startTime: string;
  priority: string;
  capacity: number;
  color?: string;
  eventId?: string | null;
  isAssigned?: boolean;
}

export function TemplateManager() {
  const toast = useToast();
  const { selectedEventId } = useEventContext(true); // Admin mode
  const [globalTemplates, setGlobalTemplates] = useState<ShiftTemplate[]>([]);
  const [eventTemplates, setEventTemplates] = useState<ShiftTemplate[]>([]);
  const [assignedTemplateIds, setAssignedTemplateIds] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [isEventSpecific, setIsEventSpecific] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "MOBILE_TEAM",
    durationMinutes: 360,
    startTime: "08:00",
    priority: "CORE",
    capacity: 0,
  });

  useEffect(() => {
    if (selectedEventId) {
      loadTemplates();
    }
  }, [selectedEventId]);

  async function loadTemplates() {
    if (!selectedEventId) return;

    try {
      // Load global templates
      const globalRes = await fetch("/api/shifts/templates");
      if (globalRes.ok) {
        const data = await globalRes.json();
        setGlobalTemplates(unwrapApiResponse<ShiftTemplate[]>(data) || []);
      }

      // Load event-specific templates
      const eventRes = await fetch(
        `/api/shifts/templates?eventId=${selectedEventId}&includeGlobal=false`,
      );
      if (eventRes.ok) {
        const data = await eventRes.json();
        setEventTemplates(unwrapApiResponse<ShiftTemplate[]>(data) || []);
      }

      // Load assigned templates for this event
      const assignedRes = await fetch(
        `/api/events/${selectedEventId}/templates`,
      );
      if (assignedRes.ok) {
        const data = await assignedRes.json();
        const response = unwrapApiResponse<{
          assigned: any[];
          eventSpecific: any[];
        }>(data);
        const assignedList = response?.assigned || [];
        setAssignedTemplateIds(
          new Set(assignedList.map((a: any) => a.id || a.templateId)),
        );
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleAssignment(
    templateId: string,
    isCurrentlyAssigned: boolean,
  ) {
    if (!selectedEventId) return;

    try {
      if (isCurrentlyAssigned) {
        // Unassign
        const res = await fetch(
          `/api/events/${selectedEventId}/templates/${templateId}`,
          {
            method: "DELETE",
          },
        );
        if (res.ok) {
          toast.success("Template unassigned from event");
          loadTemplates();
        } else {
          const error = await res.json();
          toast.error(error.message || "Failed to unassign template");
        }
      } else {
        // Assign
        const res = await fetch(`/api/events/${selectedEventId}/templates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId }),
        });
        if (res.ok) {
          toast.success("Template assigned to event");
          loadTemplates();
        } else {
          const error = await res.json();
          toast.error(error.message || "Failed to assign template");
        }
      }
    } catch {
      toast.error("Failed to update template assignment");
    }
  }

  function handleStartNew() {
    setEditingId("new");
    setIsEventSpecific(false);
    setFormData({
      name: "",
      type: "MOBILE_TEAM",
      durationMinutes: 360,
      startTime: "08:00",
      priority: "CORE",
      capacity: 0,
    });
  }

  function handleStartEdit(template: ShiftTemplate) {
    setEditingId(template.id);
    setIsEventSpecific(!!template.eventId);
    setFormData({
      name: template.name,
      type: template.type,
      durationMinutes: template.durationMinutes,
      startTime: template.startTime,
      priority: template.priority,
      capacity: template.capacity,
    });
  }

  function handleCancel() {
    setEditingId(null);
  }

  async function handleSave() {
    if (!formData.name) {
      toast.error("Template name is required");
      return;
    }

    const payload = {
      ...formData,
      requiredRoles: [{ role: "TEAM_MEMBER", count: formData.capacity }],
      eventId: isEventSpecific ? selectedEventId : null,
    };

    try {
      const url =
        editingId === "new"
          ? "/api/shifts/templates"
          : `/api/shifts/templates/${editingId}`;

      const method = editingId === "new" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(
          editingId === "new" ? "Template created" : "Template updated",
        );
        loadTemplates();
        handleCancel();
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to save template");
      }
    } catch {
      toast.error("Failed to save template");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;

    try {
      const res = await fetch(`/api/shifts/templates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Template deleted");
        loadTemplates();
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to delete template");
      }
    } catch {
      toast.error("Failed to delete template");
    }
  }

  if (!selectedEventId) {
    return (
      <div className="text-center py-8 text-gray-500">
        Please select an event from the header dropdown to manage templates.
      </div>
    );
  }

  if (loading) {
    return <div className="text-gray-500">Loading templates...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Shift Templates
          </h3>
          <p className="text-sm text-gray-500">
            Assign global templates or create event-specific templates
          </p>
        </div>
        {!editingId && (
          <Button onClick={handleStartNew}>
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        )}
      </div>

      {editingId && (
        <Card className="p-6 bg-gray-50">
          <h4 className="text-md font-bold text-gray-900 mb-4">
            {editingId === "new" ? "Create Template" : "Edit Template"}
          </h4>
          <div className="space-y-4">
            {editingId === "new" && (
              <div>
                <label className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    checked={isEventSpecific}
                    onChange={(e) => setIsEventSpecific(e.target.checked)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Event-Specific (only for this event)
                  </span>
                </label>
              </div>
            )}
            <Input
              label="Template Name"
              placeholder="e.g., Mobile Team - Morning"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
            {/* Shift Type and Priority are set by defaults — hidden from UI */}
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Start Time"
                type="time"
                value={formData.startTime}
                onChange={(e) =>
                  setFormData({ ...formData, startTime: e.target.value })
                }
              />
              <Input
                label="Duration (hours)"
                type="number"
                min="1"
                max="24"
                value={formData.durationMinutes / 60}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    durationMinutes: parseInt(e.target.value) * 60 || 60,
                  })
                }
              />
              <Input
                label="Capacity"
                type="number"
                min="0"
                value={formData.capacity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    capacity: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
              />
            </div>
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

      {/* Global Templates - Assignable */}
      <div>
        <h4 className="text-md font-semibold text-gray-900 mb-3">
          Global Templates
        </h4>
        <p className="text-sm text-gray-500 mb-4">
          Check templates to assign them to this event
        </p>
        <div className="space-y-2">
          {globalTemplates.length === 0 ? (
            <Card className="p-4 text-center text-sm text-gray-500">
              No global templates available
            </Card>
          ) : (
            globalTemplates.map((template) => {
              const isAssigned = assignedTemplateIds.has(template.id);
              return (
                <Card
                  key={template.id}
                  className={cn(
                    "p-4 flex items-center gap-4 cursor-pointer transition-all",
                    isAssigned
                      ? "bg-primary-50 border-primary-300"
                      : "hover:bg-gray-50",
                  )}
                  onClick={() =>
                    handleToggleAssignment(template.id, isAssigned)
                  }
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                        isAssigned
                          ? "bg-primary-600 border-primary-600"
                          : "bg-white border-gray-300",
                      )}
                    >
                      {isAssigned && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-900">
                      {template.name}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {template.startTime} ({template.durationMinutes / 60}h)
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {template.capacity} people
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(template);
                      }}
                      disabled={!!editingId}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(template.id);
                      }}
                      disabled={!!editingId}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Event-Specific Templates */}
      <div>
        <h4 className="text-md font-semibold text-gray-900 mb-3">
          Event-Specific Templates
        </h4>
        <p className="text-sm text-gray-500 mb-4">
          Templates created specifically for this event
        </p>
        <div className="space-y-2">
          {eventTemplates.length === 0 ? (
            <Card className="p-4 text-center text-sm text-gray-500">
              No event-specific templates yet
            </Card>
          ) : (
            eventTemplates.map((template) => (
              <Card
                key={template.id}
                className="p-4 flex items-center justify-between bg-blue-50 border-blue-200"
              >
                <div>
                  <div className="font-bold text-gray-900">{template.name}</div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {template.startTime} ({template.durationMinutes / 60}h)
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {template.capacity} people
                    </span>
                    <span className="text-xs bg-blue-200 px-2 py-0.5 rounded font-semibold">
                      EVENT-SPECIFIC
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStartEdit(template)}
                    disabled={!!editingId}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(template.id)}
                    disabled={!!editingId}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
