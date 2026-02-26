import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";
import type { Prisma } from "@prisma/client";

export class AssignmentRepository extends BaseRepository {
  async findById(id: string) {
    try {
      const assignment = await prisma.assignment.findUnique({
        where: { id },
        include: {
          shift: {
            include: {
              event: true,
              requiredRoles: true,
            },
          },
          teamMember: true,
        },
      });

      if (!assignment) {
        this.throwFormattedException("NOT_FOUND", `Assignment ${id} not found`);
      }

      return assignment;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      throw this.handlePrismaError(error, "Failed to fetch assignment");
    }
  }

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

  async findByEvent(eventId: string) {
    return this.findAll({ shift: { eventId } });
  }

  async delete(id: string) {
    try {
      return await prisma.assignment.delete({
        where: { id },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to delete assignment");
    }
  }

  async createManual(data: {
    shiftId: string;
    teamMemberId: string;
    role: string;
    assignmentType: string;
  }) {
    try {
      return await prisma.assignment.create({
        data: {
          shiftId: data.shiftId,
          teamMemberId: data.teamMemberId,
          role: data.role as any,
          isLead: false,
          assignmentType: data.assignmentType as any,
        },
        include: {
          shift: true,
          teamMember: true,
        },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create assignment");
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
              role: assignment.role as any,
              isLead: assignment.isLead || false,
              assignmentType: assignment.assignmentType as any,
              algorithmScore:
                (scores.get(
                  `${assignment.teamMemberId}-${assignment.shiftId}`,
                ) as any) ?? null,
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

  async swapAssignments(
    assignment1Id: string,
    assignment2Id: string,
    a1Data: {
      shiftId: string;
      teamMemberId: string;
      role: string;
      isLead: boolean;
      notes: string | null;
    },
    a2Data: {
      shiftId: string;
      teamMemberId: string;
      role: string;
      isLead: boolean;
      notes: string | null;
    },
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Delete existing assignments
        await tx.assignment.deleteMany({
          where: { id: { in: [assignment1Id, assignment2Id] } },
        });

        // Create swapped assignments
        const newA1 = await tx.assignment.create({
          data: {
            shiftId: a1Data.shiftId,
            teamMemberId: a1Data.teamMemberId,
            role: a1Data.role as any,
            isLead: a1Data.isLead,
            assignmentType: "SWAP",
            notes: a1Data.notes,
          },
          include: {
            shift: true,
            teamMember: true,
          },
        });

        const newA2 = await tx.assignment.create({
          data: {
            shiftId: a2Data.shiftId,
            teamMemberId: a2Data.teamMemberId,
            role: a2Data.role as any,
            isLead: a2Data.isLead,
            assignmentType: "SWAP",
            notes: a2Data.notes,
          },
          include: {
            shift: true,
            teamMember: true,
          },
        });

        return [newA1, newA2];
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to swap assignments");
    }
  }
}
