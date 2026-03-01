import { format } from "date-fns";

export interface ShiftDisplayInfo {
  templateName: string;
  timeRange: string;
  date: string;
  capacity: number;
  assignedCount: number;
  desirabilityScore: number;
  members: { alias: string; avatarId?: string }[];
}

/**
 * Extract display info from a shift object for consistent rendering across list view,
 * canvas sidebar, and create-shift panel.
 */
export function getShiftDisplayInfo(shift: {
  template?: { name?: string } | null;
  type?: string;
  startTime?: string | Date;
  endTime?: string | Date;
  capacity?: number;
  desirabilityScore?: number;
  assignments?: Array<{ teamMember?: { alias?: string; avatarId?: string } }>;
  _count?: { assignments?: number };
} | null): ShiftDisplayInfo {
  if (!shift) {
    return {
      templateName: "Shift",
      timeRange: "—",
      date: "—",
      capacity: 0,
      assignedCount: 0,
      desirabilityScore: 3,
      members: [],
    };
  }

  const templateName =
    shift.template?.name ?? (shift.type ?? "Shift").replace(/_/g, " ");
  const start = shift.startTime ? new Date(shift.startTime) : null;
  const end = shift.endTime ? new Date(shift.endTime) : null;
  const timeRange =
    start && end
      ? `${format(start, "HH:mm")}–${format(end, "HH:mm")}`
      : "—";
  const date = start ? format(start, "MMM do, yyyy") : "—";
  const capacity = shift.capacity ?? 0;
  const assignments = shift.assignments ?? [];
  const assignedCount =
    assignments.length ?? shift._count?.assignments ?? 0;
  const members = assignments
    .map((a) => ({
      alias: a.teamMember?.alias ?? "?",
      avatarId: a.teamMember?.avatarId,
    }))
    .filter((m) => m.alias);

  return {
    templateName,
    timeRange,
    date,
    capacity,
    assignedCount,
    desirabilityScore: shift.desirabilityScore ?? 3,
    members,
  };
}
