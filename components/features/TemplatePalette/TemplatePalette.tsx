"use client";

import { Clock, GripVertical } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ColorStripe } from "@/components/ui/ColorStripe";
import { useCache } from "@/lib/cache/useCache";
import { unwrapApiResponse } from "@/lib/api-errors";
import { ShiftType } from "@prisma/client";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { getPaletteColor } from "@/lib/utils/palette";

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
  compact?: boolean;
  index?: number;
}

function TemplateItem({ template, compact = false, index = 0 }: TemplateItemProps) {
  const [isDragging, setIsDragging] = useState(false);
  const resolvedColor = template.color || getPaletteColor(index);

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

  if (compact) {
    return (
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className={cn(
          "group flex items-center gap-2 px-3 py-1.5 rounded-lg",
          "bg-white hover:bg-gray-50 cursor-grab active:cursor-grabbing",
          "border border-transparent hover:border-gray-200 transition-colors",
          isDragging && "opacity-50",
          "shrink-0",
        )}
      >
        <ColorStripe color={resolvedColor} className="h-6" />
        <span className="font-medium text-xs text-gray-900 truncate">
          {template.name}
        </span>
        <GripVertical className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        "group flex items-center gap-3 p-2 rounded-lg",
        "hover:bg-gray-50 cursor-grab active:cursor-grabbing",
        "border border-transparent hover:border-gray-200 transition-colors",
        isDragging && "opacity-50",
      )}
    >
      <ColorStripe color={resolvedColor} className="h-8" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {template.name}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>
            {template.startTime} ({Math.round(template.durationMinutes / 60)}h)
          </span>
        </div>
      </div>
      <GripVertical className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

interface TemplatePaletteProps {
  eventId?: string;
  layout?: "vertical" | "horizontal";
}

export function TemplatePalette({
  eventId,
  layout = "vertical",
}: TemplatePaletteProps) {
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

  const isHorizontal = layout === "horizontal";

  return (
    <Card className={cn("p-3", isHorizontal && "px-4 py-2")} elevation={1}>
      <div className={cn(isHorizontal && "flex items-center gap-3")}>
        <h3
          className={cn(
            "text-xs font-bold text-gray-400 uppercase tracking-widest",
            isHorizontal ? "shrink-0" : "mb-3 px-1",
          )}
        >
          Templates
        </h3>
        <div
          className={cn(
            isHorizontal
              ? "flex items-center gap-2 overflow-x-auto flex-1"
              : "space-y-2 max-h-[400px] overflow-y-auto",
          )}
        >
          {templates.map((template, index) => (
            <TemplateItem
              key={template.id}
              template={template}
              compact={isHorizontal}
              index={index}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
