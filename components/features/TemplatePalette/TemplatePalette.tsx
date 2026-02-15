"use client";

import { Clock, GripVertical } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useCache } from "@/lib/cache/useCache";
import { unwrapApiResponse } from "@/lib/api-errors";
import { ShiftType } from "@prisma/client";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface ShiftTemplate {
  id: string;
  name: string;
  type: ShiftType;
  durationMinutes: number;
  startTime: string;
  priority: string;
  capacity: number;
  color?: string;
}

interface TemplateItemProps {
  template: ShiftTemplate;
}

function TemplateItem({ template }: TemplateItemProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      "application/shiftaware-template",
      JSON.stringify(template),
    );
    e.dataTransfer.effectAllowed = "copy";
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
    >
      <Card elevation={1} hover className="p-3">
        <div className="flex items-start gap-2">
          <GripVertical className="w-4 h-4 text-gray-400 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-900 truncate">
              {template.name}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span>
                {template.startTime} (
                {Math.round(template.durationMinutes / 60)}h)
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {template.type.replace("_", " ")} • {template.capacity} people
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

interface TemplatePaletteProps {
  eventId?: string;
}

export function TemplatePalette({ eventId }: TemplatePaletteProps) {
  const { data: templates, loading } = useCache<ShiftTemplate[]>({
    key: eventId ? `shift-templates-${eventId}` : "shift-templates",
    fetchFn: async () => {
      const url = eventId
        ? `/api/shifts/templates?eventId=${eventId}`
        : "/api/shifts/templates";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch templates");
      const json = await res.json();
      return unwrapApiResponse<ShiftTemplate[]>(json);
    },
    enabled: eventId ? true : undefined,
  });

  if (loading) {
    return (
      <Card className="p-4">
        <div className="text-sm text-gray-500">Loading templates...</div>
      </Card>
    );
  }

  if (!templates || templates.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-sm text-gray-500 text-center">
          No templates yet.
          <br />
          <a href="/admin/setup" className="text-primary-600 hover:underline">
            Create templates
          </a>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3" elevation={1}>
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">
        Templates
      </h3>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {templates.map((template) => (
          <TemplateItem key={template.id} template={template} />
        ))}
      </div>
    </Card>
  );
}
