import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";
import type { Prisma } from "@prisma/client";

export class AssignmentRepository extends BaseRepository {
  async findAll(where?: Prisma.AssignmentWhereInput) {
    try {
      return await prisma.assignment.findMany({
        where,
        include: {
          shift: {
            include: {
              event: true,
              requiredRoles: true,
            },
          },
          teamMember: true,
        },
        orderBy: [
          { shift: { startTime: "asc" } },
          { teamMember: { alias: "asc" } },
        ],
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch assignments");
    }
  }

  async deleteByEvent(eventId: string) {
    try {
      return await prisma.assignment.deleteMany({
        where: {
          shift: { eventId },
        },
      });
    } catch (error) {
      throw this.handlePrismaError(
        error,
        "Failed to delete assignments for event",
      );
    }
  }

  async bulkCreate(
    assignments: Array<{
      shiftId: string;
      teamMemberId: string;
      role: string;
      isLead: boolean;
      assignmentType: string;
    }>,
    scores: Map<string, number>,
    explanations: Map<string, string>,
  ) {
    try {
      return await prisma.$transaction(
        assignments.map((assignment) =>
          prisma.assignment.create({
            data: {
              shiftId: assignment.shiftId,
              teamMemberId: assignment.teamMemberId,
              role: assignment.role,
              isLead: assignment.isLead || false,
              assignmentType: assignment.assignmentType,
              algorithmScore:
                scores.get(
                  `${assignment.teamMemberId}-${assignment.shiftId}`,
                ) ?? null,
              notes:
                explanations.get(
                  `${assignment.teamMemberId}-${assignment.shiftId}`,
                ) || null,
            },
            include: {
              shift: true,
              teamMember: true,
            },
          }),
        ),
      );
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to bulk create assignments");
    }
  }
}
