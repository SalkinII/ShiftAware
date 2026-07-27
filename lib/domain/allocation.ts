import { prisma } from "@/lib/db";
import { AssignmentRepository } from "@/lib/repositories/assignment.repository";
import { EventRepository } from "@/lib/repositories/event.repository";
import { TeamMemberRepository } from "@/lib/repositories/team-member.repository";
import { assertEventStatusAllows } from "@/lib/domain/event-status";
import { runAssignmentAlgorithm } from "@/lib/algorithm/optimizer";

const assignmentRepo = new AssignmentRepository();
const eventRepo = new EventRepository();
const memberRepo = new TeamMemberRepository();

async function loadAllocationContext(
  eventId: string,
  scope?: { memberIds?: string[]; shiftIds?: string[] },
) {
  const event = await eventRepo.findById(eventId);

  const registrations = await prisma.eventRegistration.findMany({
    where: {
      eventId,
      ...(scope?.memberIds ? { memberId: { in: scope.memberIds } } : {}),
    },
    include: {
      member: {
        include: {
          preferences: { include: { shift: true } },
          assignments: { include: { shift: true } },
        },
      },
    },
  });
  const members = registrations.map((r) => r.member);

  const shifts = await prisma.shift.findMany({
    where: {
      eventId,
      ...(scope?.shiftIds ? { id: { in: scope.shiftIds } } : {}),
    },
    include: {
      preferences: { include: { teamMember: true } },
      assignments: { include: { teamMember: true } },
      requiredRoles: true,
      event: true,
    },
    orderBy: { startTime: "asc" },
  });

  const config = event.config || {
    minShiftsPerPerson: 2,
    algorithmWeights: { preferenceMatch: 0.7, workloadFairness: 0.3 },
    balanceThresholds: {} as any,
    allocationRules: [] as any,
  };

  const weights =
    typeof config.algorithmWeights === "object" && config.algorithmWeights !== null
      ? (config.algorithmWeights as any)
      : { preferenceMatch: 0.7, workloadFairness: 0.3 };

  const assignableShifts = shifts.filter((s) => s.capacity > 0);
  const coreShifts = assignableShifts.filter((s) => s.priority === "CORE");
  const balanceThresholds =
    typeof config.balanceThresholds === "object" && config.balanceThresholds !== null
      ? (config.balanceThresholds as any)
      : {};
  const minRestHours = balanceThresholds.minRestHours ?? 8;
  const maxShiftsPerPerson = balanceThresholds.maxShiftsPerPerson ?? Infinity;
  const allocationRules = Array.isArray(config.allocationRules) ? config.allocationRules : [];

  const memberAttributes = new Map<string, Map<string, string>>();
  for (const member of members) {
    const attrs = await memberRepo.getAttributes(member.id, eventId);
    const attrMap = new Map<string, string>();
    for (const attr of attrs) {
      attrMap.set(attr.definition.name, JSON.parse(attr.value));
    }
    memberAttributes.set(member.id, attrMap);
  }

  return {
    members,
    assignableShifts,
    coreShifts,
    config,
    weights,
    minRestHours,
    maxShiftsPerPerson,
    allocationRules,
    memberAttributes,
  };
}

export async function runAllocation(eventId: string, dryRun = false) {
  await assertEventStatusAllows(eventId, "ASSIGNMENT_ALGORITHM");

  const {
    members,
    assignableShifts,
    coreShifts,
    config,
    weights,
    minRestHours,
    maxShiftsPerPerson,
    allocationRules,
    memberAttributes,
  } = await loadAllocationContext(eventId);

  const result = await runAssignmentAlgorithm(
    members as any,
    assignableShifts as any,
    {
      minShiftsPerPerson: config.minShiftsPerPerson || 2,
      maxShiftsPerPerson,
      minRestMs: minRestHours * 3600000,
      coreShifts,
      allocationRules,
      weights,
      memberAttributes,
      dryRun,
    },
  );

  if (dryRun) {
    const memberAliases = Object.fromEntries(members.map((m) => [m.id, m.alias]));
    const shiftCoverage: Record<string, { assigned: number; capacity: number }> = {};
    for (const s of assignableShifts) {
      const assigned = result.assignments.filter((a) => a.shiftId === s.id).length;
      shiftCoverage[s.id] = { assigned, capacity: s.capacity };
    }
    return {
      assignments: result.assignments,
      violations: result.violations,
      scores: Object.fromEntries(result.scores),
      explanations: Object.fromEntries(result.explanations),
      ruleMatchSummaries: result.ruleMatchSummaries ?? [],
      memberAliases,
      shiftCoverage,
      dryRun: true,
    };
  }

  const saved = await prisma.$transaction(async (tx) => {
    await tx.assignment.deleteMany({ where: { shift: { eventId } } });
    const created = [];
    for (const assignment of result.assignments) {
      const key = `${assignment.teamMemberId}-${assignment.shiftId}`;
      const record = await tx.assignment.create({
        data: {
          shiftId: assignment.shiftId,
          teamMemberId: assignment.teamMemberId,
          role: assignment.role as any,
          isLead: assignment.isLead || false,
          assignmentType: assignment.assignmentType as any,
          algorithmScore: (result.scores.get(key) as any) ?? null,
          notes: result.explanations.get(key) || null,
        },
        include: { shift: true, teamMember: true },
      });
      created.push(record);
    }
    return created;
  });

  return {
    assignments: saved,
    violations: result.violations,
    scores: Object.fromEntries(result.scores),
    explanations: Object.fromEntries(result.explanations),
  };
}

export async function redistributeScoped(
  eventId: string,
  scope: { memberIds?: string[]; shiftIds?: string[] },
  dryRun = false,
) {
  await assertEventStatusAllows(eventId, "ASSIGNMENT_ALGORITHM");

  const {
    members,
    assignableShifts,
    coreShifts,
    config,
    weights,
    minRestHours,
    maxShiftsPerPerson,
    allocationRules,
    memberAttributes,
  } = await loadAllocationContext(eventId, scope);

  const result = await runAssignmentAlgorithm(
    members as any,
    assignableShifts as any,
    {
      minShiftsPerPerson: config.minShiftsPerPerson || 2,
      maxShiftsPerPerson,
      minRestMs: minRestHours * 3600000,
      coreShifts,
      allocationRules,
      weights,
      memberAttributes,
      dryRun,
    },
  );

  if (dryRun) {
    return {
      assignments: result.assignments,
      violations: result.violations,
      dryRun: true,
    };
  }

  const saved = await prisma.$transaction(async (tx) => {
    const deleteWhere: any = { shift: { eventId } };
    if (scope.memberIds) deleteWhere.teamMemberId = { in: scope.memberIds };
    if (scope.shiftIds) deleteWhere.shiftId = { in: scope.shiftIds };
    await tx.assignment.deleteMany({ where: deleteWhere });
    const created = [];
    for (const assignment of result.assignments) {
      const key = `${assignment.teamMemberId}-${assignment.shiftId}`;
      const record = await tx.assignment.create({
        data: {
          shiftId: assignment.shiftId,
          teamMemberId: assignment.teamMemberId,
          role: assignment.role as any,
          isLead: assignment.isLead || false,
          assignmentType: assignment.assignmentType as any,
          algorithmScore: (result.scores.get(key) as any) ?? null,
          notes: result.explanations.get(key) || null,
        },
        include: { shift: true, teamMember: true },
      });
      created.push(record);
    }
    return created;
  });

  return { assignments: saved, violations: result.violations };
}

export async function createManualAssignment(data: {
  shiftId: string;
  teamMemberId: string;
  role?: string;
  assignmentType?: string;
}) {
  const shiftRecord = await prisma.shift.findUnique({
    where: { id: data.shiftId },
    select: { eventId: true, capacity: true },
  });
  if (!shiftRecord) throw new Error("Shift not found");
  const registration = await prisma.eventRegistration.findUnique({
    where: { memberId_eventId: { memberId: data.teamMemberId, eventId: shiftRecord.eventId } },
  });
  if (!registration) throw new Error("Member is not registered for this event");
  if (shiftRecord.capacity === 0) throw new Error("Cannot assign members to a marker shift (capacity is 0)");
  await assertEventStatusAllows(shiftRecord.eventId, "ASSIGNMENT_MANUAL");
  return assignmentRepo.createManual({
    shiftId: data.shiftId,
    teamMemberId: data.teamMemberId,
    role: data.role || "TEAM_MEMBER",
    assignmentType: data.assignmentType || "MANUAL",
  });
}

export async function deleteAssignment(assignmentId: string) {
  const assignment = await assignmentRepo.findById(assignmentId);
  await assertEventStatusAllows(assignment.shift.eventId, "ASSIGNMENT_MANUAL");
  const directRequests = await prisma.swapRequest.findMany({
    where: { fromAssignmentId: assignmentId },
    select: { matchedWithId: true },
  });
  const partnerIds = directRequests.map((sr) => sr.matchedWithId).filter((id): id is string => id !== null);
  if (partnerIds.length > 0) {
    await prisma.swapRequest.updateMany({
      where: { id: { in: partnerIds } },
      data: { status: "PENDING", matchedWithId: null },
    });
  }
  return assignmentRepo.delete(assignmentId);
}

export async function swapAssignments(assignment1Id: string, assignment2Id: string) {
  const a1 = await assignmentRepo.findById(assignment1Id);
  const a2 = await assignmentRepo.findById(assignment2Id);
  const eventId = a1.shift.eventId;
  await assertEventStatusAllows(eventId, "ASSIGNMENT_MANUAL");
  if (a1.shiftId === a2.shiftId) {
    throw new Error(
      "Cannot swap assignments on the same shift. Assignments must be on different shifts.",
    );
  }
  const allAssignments = await assignmentRepo.findAll({ shift: { eventId } });
  if (allAssignments.find((a) => a.shiftId === a1.shiftId && a.teamMemberId === a2.teamMemberId && a.id !== a1.id)) {
    throw new Error("Member is already assigned to this shift. Cannot swap.");
  }
  if (allAssignments.find((a) => a.shiftId === a2.shiftId && a.teamMemberId === a1.teamMemberId && a.id !== a2.id)) {
    throw new Error("Member is already assigned to this shift. Cannot swap.");
  }
  return assignmentRepo.swapAssignments(
    assignment1Id, assignment2Id,
    { shiftId: a1.shiftId, teamMemberId: a2.teamMemberId, role: a1.role, isLead: a1.isLead, notes: a1.notes },
    { shiftId: a2.shiftId, teamMemberId: a1.teamMemberId, role: a2.role, isLead: a2.isLead, notes: a2.notes },
  );
}
