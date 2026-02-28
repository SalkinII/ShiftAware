import { AssignmentRepository } from "@/lib/repositories/assignment.repository";
import { EventRepository } from "@/lib/repositories/event.repository";
import { MembersService } from "@/lib/services/members.service";
import { assertEventStatusAllows } from "@/lib/services/event-status-guard";
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
    const a1 = await this.repo.findById(assignment1Id);
    const a2 = await this.repo.findById(assignment2Id);
    const eventId = a1.shift.eventId;
    await assertEventStatusAllows(eventId, "ASSIGNMENT_MANUAL");

    // Validate: Cannot swap if assignments are on the same shift
    if (a1.shiftId === a2.shiftId) {
      throw new Error(
        "Cannot swap assignments on the same shift. Assignments must be on different shifts.",
      );
    }

    // Validate: Check if swap would create conflicts (scope to event)
    const allAssignments = await this.repo.findAll({
      shift: { eventId },
    });

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

  async createManualAssignment(data: {
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

    // Verify member is registered for this event
    const registration = await prisma.eventRegistration.findUnique({
      where: {
        memberId_eventId: {
          memberId: data.teamMemberId,
          eventId: shiftRecord.eventId,
        },
      },
    });
    if (!registration) {
      throw new Error("Member is not registered for this event");
    }
    if (shiftRecord.capacity === 0) {
      throw new Error("Cannot assign members to a marker shift (capacity is 0)");
    }

    await assertEventStatusAllows(shiftRecord.eventId, "ASSIGNMENT_MANUAL");
    return this.repo.createManual({
      shiftId: data.shiftId,
      teamMemberId: data.teamMemberId,
      role: data.role || "TEAM_MEMBER",
      assignmentType: data.assignmentType || "MANUAL",
    });
  }

  async deleteAssignment(assignmentId: string) {
    const assignment = await this.repo.findById(assignmentId);
    await assertEventStatusAllows(
      assignment.shift.eventId,
      "ASSIGNMENT_MANUAL",
    );
    return this.repo.delete(assignmentId);
  }

  async runAllocation(eventId: string, preview = false) {
    await assertEventStatusAllows(eventId, "ASSIGNMENT_ALGORITHM");
    const event = await this.eventRepo.findById(eventId);

    // 2. Load event-registered members with preferences and assignments
    const registrations = await prisma.eventRegistration.findMany({
      where: { eventId },
      include: {
        member: {
          include: {
            preferences: {
              include: { shift: true },
            },
            assignments: {
              include: { shift: true },
            },
          },
        },
      },
    });
    const members = registrations.map((r) => r.member);

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
      balanceThresholds: {} as any,
      allocationRules: [] as any,
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

    const assignableShifts = shifts.filter((s) => s.capacity > 0);
    const coreShifts = assignableShifts.filter((s) => s.priority === "CORE");

    // Extract minRestMs and maxShiftsPerPerson from config
    const balanceThresholds =
      typeof config.balanceThresholds === "object" && config.balanceThresholds !== null
        ? (config.balanceThresholds as any)
        : {};
    const minRestHours = balanceThresholds.minRestHours ?? 8;
    const maxShiftsPerPerson = balanceThresholds.maxShiftsPerPerson ?? Infinity;

    // Extract allocation rules
    const allocationRules = Array.isArray(config.allocationRules)
      ? config.allocationRules
      : [];

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

    // 6. Run algorithm (only assignable shifts)
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
      },
    );

    // 7. If preview, return without saving
    if (preview) {
      return {
        assignments: result.assignments,
        violations: result.violations,
        scores: Object.fromEntries(result.scores),
        explanations: Object.fromEntries(result.explanations),
      };
    }

    // 8. Clear old, save new — atomic transaction
    const saved = await prisma.$transaction(async (tx) => {
      // Delete swap requests referencing this event's assignments first
      await tx.swapRequest.deleteMany({
        where: {
          fromAssignment: { shift: { eventId } },
        },
      });

      await tx.assignment.deleteMany({
        where: { shift: { eventId } },
      });

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
}
