export interface LaneConfig {
  /** Unique identifier: template.id or "unassigned" */
  id: string;
  /** Template ID for matching shifts; null for Unassigned lane */
  templateId: string | null;
  /** Display label */
  label: string;
  /** Lane colour from palette */
  color: string;
  /** Vertical order */
  order: number;
  /** Shift type for API (from template) */
  type: string;
}

/** Minimal template shape needed for lane derivation */
export interface TemplateLike {
  id: string;
  name: string;
  type: string;
  color?: string | null;
  laneOrder?: number | null;
}

/** Unassigned lane ID for shifts with templateId = null */
export const UNASSIGNED_LANE_ID = "unassigned";

import { getPaletteColor } from "@/lib/utils/palette";

/** Legacy: color for shift type display (e.g. ShiftPropertiesPanel) */
export function getLaneColor(type: string): string {
  const colors: Record<string, string> = {
    MOBILE_TEAM: "#0ea5e9",
    STATIONARY: "#22c55e",
    SUPER: "#f59e0b",
    EXTENDED: "#78716c",
    BUFFER: "#6b7280",
    SHIFT_LEAD: "#8b5cf6",
  };
  return colors[type] ?? "#6b7280";
}

/** Legacy: label for shift type display */
export function getLaneLabel(type: string): string {
  const labels: Record<string, string> = {
    MOBILE_TEAM: "Mobile Team",
    STATIONARY: "Stationary",
    SUPER: "SUPER",
    EXTENDED: "Extended Service",
    BUFFER: "Buffer",
    SHIFT_LEAD: "Shift Lead",
  };
  return labels[type] ?? type.replace(/_/g, " ");
}

/**
 * Derive lane configuration from assigned templates.
 * One lane per template, colours from cycling palette.
 */
export function deriveLanesFromTemplates(
  templates: TemplateLike[],
): LaneConfig[] {
  if (!templates || templates.length === 0) {
    return [];
  }

  const lanes: LaneConfig[] = templates.map((t, index) => ({
    id: t.id,
    templateId: t.id,
    label: t.name || t.type.replace(/_/g, " "),
    color: t.color || getPaletteColor(index),
    order: t.laneOrder ?? index,
    type: t.type,
  }));

  // Add Notes catch-all lane for shifts with templateId = null, and for markers
  lanes.push({
    id: UNASSIGNED_LANE_ID,
    templateId: null,
    label: "Notes",
    color: "#6b7280",
    order: 999,
    type: "MOBILE_TEAM", // fallback for API
  });

  return lanes.sort((a, b) => a.order - b.order);
}
