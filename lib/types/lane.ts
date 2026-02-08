export interface LaneConfig {
  type: string;
  label: string;
  color: string;
  order: number;
}

export const LANE_CONFIG: Record<string, LaneConfig> = {
  MOBILE_TEAM: {
    type: "MOBILE_TEAM",
    label: "Mobile Team",
    color: "#0ea5e9",
    order: 1,
  },
  STATIONARY: {
    type: "STATIONARY",
    label: "Stationary",
    color: "#22c55e",
    order: 3,
  },
  SUPER: {
    type: "SUPER",
    label: "SUPER",
    color: "#f59e0b",
    order: 4,
  },
  EXTENDED: {
    type: "EXTENDED",
    label: "Extended Service",
    color: "#78716c",
    order: 5,
  },
};

export const LANES_ORDERED = Object.values(LANE_CONFIG).sort(
  (a, b) => a.order - b.order,
);

export function getLaneColor(type: string): string {
  return LANE_CONFIG[type]?.color ?? "#6b7280";
}

export function getLaneLabel(type: string): string {
  return LANE_CONFIG[type]?.label ?? type.replace(/_/g, " ");
}

/** Minimal template shape needed for lane derivation */
export interface TemplateLike {
  id: string;
  name: string;
  type: string;
  color?: string | null;
  laneOrder?: number | null;
}

/**
 * Derive lane configuration from assigned templates.
 * Falls back to LANE_CONFIG for color/order when template doesn't specify them.
 */
export function deriveLanesFromTemplates(
  templates: TemplateLike[],
): LaneConfig[] {
  if (!templates || templates.length === 0) {
    return LANES_ORDERED; // fallback to hardcoded lanes
  }

  // Deduplicate by type (multiple templates can share a type/lane)
  const laneMap = new Map<string, LaneConfig>();

  for (const t of templates) {
    if (!laneMap.has(t.type)) {
      laneMap.set(t.type, {
        type: t.type,
        label: t.name || getLaneLabel(t.type),
        color: t.color || getLaneColor(t.type),
        order: t.laneOrder ?? LANE_CONFIG[t.type]?.order ?? 99,
      });
    }
  }

  return Array.from(laneMap.values()).sort((a, b) => a.order - b.order);
}
