export interface LaneConfig {
  type: string;
  label: string;
  color: string;
  order: number;
}

export const LANE_CONFIG: Record<string, LaneConfig> = {
  MOBILE_TEAM_1: {
    type: "MOBILE_TEAM_1",
    label: "Mobile Team 1",
    color: "#0ea5e9",
    order: 1,
  },
  MOBILE_TEAM_2: {
    type: "MOBILE_TEAM_2",
    label: "Mobile Team 2",
    color: "#8b5cf6",
    order: 2,
  },
  STATIONARY: {
    type: "STATIONARY",
    label: "Stationary",
    color: "#22c55e",
    order: 3,
  },
  EXECUTIVE: {
    type: "EXECUTIVE",
    label: "Executive",
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
