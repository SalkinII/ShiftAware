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
  (a, b) => a.order - b.order
);

export function getLaneColor(type: string): string {
  return LANE_CONFIG[type]?.color ?? "#6b7280";
}

export function getLaneLabel(type: string): string {
  return LANE_CONFIG[type]?.label ?? type.replace(/_/g, " ");
}
