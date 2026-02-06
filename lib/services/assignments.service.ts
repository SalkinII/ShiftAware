import { AssignmentRepository } from "@/lib/repositories/assignment.repository";
import { EventRepository } from "@/lib/repositories/event.repository";
import { prisma } from "@/lib/db";
import { runAssignmentAlgorithm } from "@/lib/algorithm/optimizer";
import type { Prisma } from "@prisma/client";

export class AssignmentsService {
  private repo: AssignmentRepository;
  private eventRepo: EventRepository;

  constructor(repo?: AssignmentRepository, eventRepo?: EventRepository) {
    this.repo = repo || new AssignmentRepository();
    this.eventRepo = eventRepo || new EventRepository();
  }

  async listAssignments(where?: Prisma.AssignmentWhereInput) {
    return this.repo.findAll(where);
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

    // 5. Run algorithm
    const result = await runAssignmentAlgorithm(members as any, shifts as any, {
      minShiftsPerPerson: config.minShiftsPerPerson || 2,
      coreShifts,
      weights,
    });

    // 6. If preview, return without saving
    if (preview) {
      return {
        assignments: result.assignments,
        violations: result.violations,
        scores: Object.fromEntries(result.scores),
        explanations: Object.fromEntries(result.explanations),
      };
    }

    // 7. Clear old, save new
    await this.repo.deleteByEvent(eventId);
    const saved = await this.repo.bulkCreate(
      result.assignments,
      result.scores,
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
