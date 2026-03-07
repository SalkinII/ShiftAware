import { TeamMember, Shift, Assignment, ShiftPreference } from "@prisma/client";

export interface AssignmentState {
  assignments: Map<string, Assignment[]>; // shiftId -> assignments
  memberShifts: Map<string, string[]>; // memberId -> shiftIds
  shiftCoverage: Map<string, number>; // shiftId -> current count
}

export interface AssignmentScore {
  preferenceMatch: number;
  workloadFairness: number;
  overall: number;
}

export interface AlgorithmWeights {
  preferenceMatch: number;
  workloadFairness: number;
}

export interface AlgorithmResult {
  assignments: Assignment[];
  scores: Map<string, AssignmentScore>; // assignmentId -> score
  violations: string[];
  explanations: Map<string, string>; // assignmentId -> explanation
  ruleMatchSummaries?: string[]; // per-shift rule filter exclusion reasons
}

export interface ConstraintViolation {
  type: string;
  message: string;
  severity: "hard" | "soft";
}

export interface AllocationRule {
  id: string;
  ruleKind?: "FILTER" | "BALANCE";  // defaults to "FILTER" for backward compat
  shiftType: string;
  attribute: string;
  operator: "EQUALS" | "NOT_EQUALS" | "CONTAINS" | "ONE_OF";
  value: string;
  balanceMode?: "REQUIRE_ONE" | "REQUIRE_RATIO";
  minRatio?: number;
  maxRatio?: number;
}

export type TeamMemberWithRelations = TeamMember & {
  preferences: (ShiftPreference & { shift: Shift })[];
  assignments: (Assignment & { shift: Shift })[];
};

export type ShiftWithRelations = Shift & {
  preferences: (ShiftPreference & { teamMember: TeamMember })[];
  assignments: (Assignment & { teamMember: TeamMember })[];
  requiredRoles: { role: string; count: number }[];
  event: { id: string; startDate: Date; endDate: Date };
};

