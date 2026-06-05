import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";
import type { Prisma } from "@prisma/client";

export class TeamMemberRepository extends BaseRepository {
  async findById(id: string) {
    try {
      const member = await prisma.teamMember.findUnique({
        where: { id },
      });

      if (!member) {
        this.throwFormattedException("NOT_FOUND", `Member ${id} not found`);
      }

      return member;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      throw this.handlePrismaError(error, "Failed to fetch member");
    }
  }

  async findAll(where?: Prisma.TeamMemberWhereInput) {
    try {
      return await prisma.teamMember.findMany({
        where,
        orderBy: { alias: "asc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch members");
    }
  }

  async findAllWithIncludes(
    where?: Prisma.TeamMemberWhereInput,
    include?: any,
  ) {
    try {
      return await prisma.teamMember.findMany({
        where,
        include,
        orderBy: { alias: "asc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch members");
    }
  }

  async create(data: Prisma.TeamMemberCreateInput) {
    try {
      return await prisma.teamMember.create({ data });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create member");
    }
  }

  async update(id: string, data: Prisma.TeamMemberUpdateInput) {
    try {
      return await prisma.teamMember.update({
        where: { id },
        data,
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update member");
    }
  }

  async delete(id: string) {
    try {
      return await prisma.teamMember.delete({
        where: { id },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to delete member");
    }
  }

  async findByIdWithRelations(id: string) {
    try {
      const member = await prisma.teamMember.findUnique({
        where: { id },
        include: {
          eventRegistrations: {
            include: {
              event: {
                include: { config: true },
              },
            },
          },
          preferences: {
            include: { shift: true },
            orderBy: { createdAt: "asc" },
          },
          assignments: {
            include: { shift: true },
            orderBy: { shift: { startTime: "asc" } },
          },
        },
      });

      if (!member) {
        this.throwFormattedException("NOT_FOUND", `Member ${id} not found`);
      }

      return member;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      throw this.handlePrismaError(
        error,
        "Failed to fetch member with relations",
      );
    }
  }

  async deactivate(id: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        const registrations = await tx.eventRegistration.findMany({
          where: { memberId: id, event: { status: { not: "COMPLETED" } } },
          select: { eventId: true },
        });
        const eventIds = registrations.map((r) => r.eventId);

        for (const eventId of eventIds) {
          const memberSwaps = await tx.swapRequest.findMany({
            where: {
              requesterId: id,
              fromAssignment: { shift: { eventId } },
            },
            select: { id: true },
          });
          const swapIds = memberSwaps.map((s) => s.id);

          if (swapIds.length > 0) {
            await tx.swapRequest.updateMany({
              where: { matchedWithId: { in: swapIds } },
              data: { matchedWithId: null },
            });
            await tx.swapRequest.deleteMany({
              where: { id: { in: swapIds } },
            });
          }

          await tx.assignment.deleteMany({
            where: { teamMemberId: id, shift: { eventId } },
          });

          await tx.shiftPreference.deleteMany({
            where: { teamMemberId: id, shift: { eventId } },
          });

          await tx.eventRegistration.delete({
            where: { memberId_eventId: { memberId: id, eventId } },
          });
        }

        return tx.teamMember.update({
          where: { id },
          data: { isActive: false },
        });
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to deactivate member");
    }
  }

  async permanentDelete(id: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.auditLog.updateMany({
          where: { userId: id },
          data: { userId: null },
        });

        const memberSwaps = await tx.swapRequest.findMany({
          where: { requesterId: id },
          select: { id: true },
        });
        const memberSwapIds = memberSwaps.map((s) => s.id);

        if (memberSwapIds.length > 0) {
          await tx.swapRequest.updateMany({
            where: { matchedWithId: { in: memberSwapIds } },
            data: { matchedWithId: null },
          });
        }

        await tx.swapRequest.deleteMany({
          where: { requesterId: id },
        });

        await tx.assignment.deleteMany({
          where: { teamMemberId: id },
        });

        await tx.shiftPreference.deleteMany({
          where: { teamMemberId: id },
        });

        return tx.teamMember.delete({
          where: { id },
        });
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to permanently delete member");
    }
  }

  // --- TeamMemberAttribute methods ---
  async getAttributes(memberId: string, eventId?: string) {
    try {
      const where: any = { memberId };
      if (eventId) {
        where.definition = { eventId };
      }
      return await prisma.teamMemberAttribute.findMany({
        where,
        include: { definition: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch member attributes");
    }
  }

  async findAttributeDefinition(eventId: string, name: string) {
    try {
      return await prisma.eventAttributeDefinition.findFirst({
        where: { eventId, name },
      });
    } catch (error) {
      throw this.handlePrismaError(
        error,
        "Failed to find attribute definition",
      );
    }
  }

  async upsertAttribute(memberId: string, definitionId: string, value: string) {
    try {
      return await prisma.teamMemberAttribute.upsert({
        where: {
          memberId_definitionId: { memberId, definitionId },
        },
        update: { value },
        create: { memberId, definitionId, value },
        include: { definition: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to upsert member attribute");
    }
  }
}
