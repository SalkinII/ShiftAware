import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";

export class EnvironmentRegistrationRepository extends BaseRepository {
  async listRegistrations(environmentId: string) {
    try {
      return await prisma.environmentRegistration.findMany({
        where: { environmentId },
        include: {
          member: {
            include: {
              attributes: {
                include: { definition: true },
                where: { definition: { requirements: { some: { environmentId } } } },
              },
            },
          },
        },
        orderBy: { registeredAt: "asc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch registrations");
    }
  }

  async createRegistration(environmentId: string, memberId: string, status: string) {
    try {
      return await prisma.environmentRegistration.create({
        data: { memberId, environmentId, status: status as any },
        include: { member: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create registration");
    }
  }

  async findRegistration(environmentId: string, memberId: string) {
    try {
      return await prisma.environmentRegistration.findUnique({
        where: { memberId_environmentId: { memberId, environmentId } },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to find registration");
    }
  }

  async getRegistration(environmentId: string, memberId: string) {
    try {
      return await prisma.environmentRegistration.findUnique({
        where: { memberId_environmentId: { memberId, environmentId } },
        include: {
          member: {
            include: {
              attributes: {
                include: { definition: true },
                where: { definition: { requirements: { some: { environmentId } } } },
              },
            },
          },
        },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch registration");
    }
  }

  async updateRegistration(
    environmentId: string,
    memberId: string,
    data: Record<string, unknown>,
  ) {
    try {
      return await prisma.environmentRegistration.update({
        where: { memberId_environmentId: { memberId, environmentId } },
        data: data as any,
        include: { member: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update registration");
    }
  }

  async deleteRegistrationWithCleanup(environmentId: string, memberId: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        const memberSwaps = await tx.swapRequest.findMany({
          where: {
            requesterId: memberId,
            fromAssignment: { shift: { environmentId } },
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
          where: { teamMemberId: memberId, shift: { environmentId } },
        });

        await tx.shiftPreference.deleteMany({
          where: { teamMemberId: memberId, shift: { environmentId } },
        });

        return tx.environmentRegistration.delete({
          where: { memberId_environmentId: { memberId, environmentId } },
        });
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to delete registration");
    }
  }
}
