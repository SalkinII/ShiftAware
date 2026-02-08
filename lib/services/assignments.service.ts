import { AssignmentRepository } from "@/lib/repositories/assignment.repository";
import { EventRepository } from "@/lib/repositories/event.repository";
import { MembersService } from "@/lib/services/members.service";
import { prisma } from "@/lib/db";
import { runAssignmentAlgorithm } from "@/lib/algorithm/optimizer";
import type { Prisma } from "@prisma/client";

export class AssignmentsService {
  private repo: AssignmentRepository;
  private eventRepo: EventRepository;
  private membersService: MembersService;

  constructor(
    repo?: AssignmentRepository,
    eventRepo?: EventRepository,
    membersService?: MembersService,
  ) {
    this.repo = repo || new AssignmentRepository();
    this.eventRepo = eventRepo || new EventRepository();
    this.membersService = membersService || new MembersService();
  }

  async listAssignments(where?: Prisma.AssignmentWhereInput) {
    return this.repo.findAll(where);
  }

  async getAssignment(id: string) {
    return this.repo.findById(id);
  }

  async swapAssignments(assignment1Id: string, assignment2Id: string) {
    // Get both assignments
    const a1 = await this.repo.findById(assignment1Id);
    const a2 = await this.repo.findById(assignment2Id);

    // Validate: Cannot swap if assignments are on the same shift
    if (a1.shiftId === a2.shiftId) {
      throw new Error(
        "Cannot swap assignments on the same shift. Assignments must be on different shifts.",
      );
    }

    // Validate: Check if swap would create conflicts
    const allAssignments = await this.repo.findAll();

    const wouldConflict1 = allAssignments.find(
      (a) =>
        a.shiftId === a1.shiftId &&
        a.teamMemberId === a2.teamMemberId &&
        a.id !== a1.id,
    );

    const wouldConflict2 = allAssignments.find(
      (a) =>
        a.shiftId === a2.shiftId &&
        a.teamMemberId === a1.teamMemberId &&
        a.id !== a2.id,
    );

    if (wouldConflict1) {
      throw new Error(
        `Member is already assigned to shift ${a1.shift.type}. Cannot swap.`,
      );
    }

    if (wouldConflict2) {
      throw new Error(
        `Member is already assigned to shift ${a2.shift.type}. Cannot swap.`,
      );
    }

    // Perform swap
    return await this.repo.swapAssignments(
      assignment1Id,
      assignment2Id,
      {
        shiftId: a1.shiftId,
        teamMemberId: a2.teamMemberId,
        role: a1.role,
        isLead: a1.isLead,
        notes: a1.notes,
      },
      {
        shiftId: a2.shiftId,
        teamMemberId: a1.teamMemberId,
        role: a2.role,
        isLead: a2.isLead,
        notes: a2.notes,
      },
    );
  }

  async runAllocation(eventId: string, preview = false) {
    // 1. Load event with config
    const event = await this.eventRepo.findById(eventId);

    // 2. Load active members with preferences and assignments
    const members = await prisma.teamMember.findMany({
      where: { isActive: true },
      include: {
        preferences: {
          include: { shift: true },
        },
        assignments: {
          include: { shift: true },
        },
      },
    });

    // 3. Load shifts for event
    const shifts = await prisma.shift.findMany({
      where: { eventId },
      include: {
        preferences: {
          include: { teamMember: true },
        },
        assignments: {
          include: { teamMember: true },
        },
        requiredRoles: true,
        event: true,
      },
      orderBy: { startTime: "asc" },
    });

    // 4. Prepare config and weights
    const config = event.config || {
      minShiftsPerPerson: 2,
      algorithmWeights: {
        preferenceMatch: 0.35,
        experienceBalance: 0.25,
        workloadFairness: 0.15,
        coreShiftCoverage: 0.05,
      },
    };

    const weights =
      typeof config.algorithmWeights === "object" &&
      config.algorithmWeights !== null
        ? (config.algorithmWeights as any)
        : {
            preferenceMatch: 0.35,
            experienceBalance: 0.25,
            workloadFairness: 0.15,
            coreShiftCoverage: 0.05,
          };

    const coreShifts = shifts.filter((s) => s.priority === "CORE");

    // 5. Load member attributes for the event
    const memberAttributes = new Map<string, Map<string, string>>();
    for (const member of members) {
      const attrs = await this.membersService.getAttributes(member.id, eventId);
      const attrMap = new Map<string, string>();
      for (const attr of attrs) {
        attrMap.set(attr.definition.name, JSON.parse(attr.value));
      }
      memberAttributes.set(member.id, attrMap);
    }

    // 6. Run algorithm
    const result = await runAssignmentAlgorithm(members as any, shifts as any, {
      minShiftsPerPerson: config.minShiftsPerPerson || 2,
      coreShifts,
      weights,
      memberAttributes,
    });

    // 7. If preview, return without saving
    if (preview) {
      return {
        assignments: result.assignments,
        violations: result.violations,
        scores: Object.fromEntries(result.scores),
        explanations: Object.fromEntries(result.explanations),
      };
    }

    // 8. Clear old, save new
    await this.repo.deleteByEvent(eventId);
    const saved = await this.repo.bulkCreate(
      result.assignments,
      result.scores as any,
      result.explanations,
    );

    return {
      assignments: saved,
      violations: result.violations,
      scores: Object.fromEntries(result.scores),
      explanations: Object.fromEntries(result.explanations),
    };
  }
}
