import type { Shift, TeamMember } from "@prisma/client";
import type {
  AssignmentState,
  TeamMemberWithRelations,
  ShiftWithRelations,
} from "../../../lib/algorithm/types";

let idCounter = 0;
function nextId() {
  return `test-${++idCounter}`;
}

export function resetIds() {
  idCounter = 0;
}

export function makeMember(
  overrides: Partial<TeamMember> & {
    preferences?: any[];
    assignments?: any[];
  } = {},
): TeamMemberWithRelations {
  return {
    id: nextId(),
    alias: overrides.alias || `Member-${idCounter}`,
    experienceLevel: "INTERMEDIATE",
    avatarId: "1",
    capabilities: ["TEAM_MEMBER"],
    isActive: true,
    isAdmin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    preferences: [],
    assignments: [],
    ...overrides,
  } as TeamMemberWithRelations;
}

export function makeShift(
  overrides: Partial<Shift> & {
    requiredRoles?: any[];
    preferences?: any[];
    assignments?: any[];
  } = {},
): ShiftWithRelations {
  const id = overrides.id || nextId();
  return {
    id,
    type: "STATIONARY",
    startTime: overrides.startTime || new Date("2026-07-01T08:00:00Z"),
    endTime: overrides.endTime || new Date("2026-07-01T12:00:00Z"),
    durationMinutes: 240,
    priority: "CORE",
    desirabilityScore: 3,
    capacity: overrides.capacity ?? 2,
    eventId: "event-1",
    templateId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    requiredRoles: [],
    preferences: [],
    assignments: [],
    event: { id: "event-1", startDate: new Date(), endDate: new Date() },
    ...overrides,
  } as ShiftWithRelations;
}

export function emptyState(): AssignmentState {
  return {
    assignments: new Map(),
    memberShifts: new Map(),
    shiftCoverage: new Map(),
  };
}
