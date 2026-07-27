import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";

export class EventRegistrationRepository extends BaseRepository {
  async listRegistrations(eventId: string) {
    try {
      return await prisma.eventRegistration.findMany({
        where: { eventId },
        include: {
          member: {
            include: {
              attributes: {
                include: { definition: true },
                where: { definition: { eventId } },
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

  async createRegistration(eventId: string, memberId: string, status: string) {
    try {
      return await prisma.eventRegistration.create({
        data: { memberId, eventId, status: status as any },
        include: { member: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create registration");
    }
  }

  async findRegistration(eventId: string, memberId: string) {
    try {
      return await prisma.eventRegistration.findUnique({
        where: { memberId_eventId: { memberId, eventId } },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to find registration");
    }
  }

  async getRegistration(eventId: string, memberId: string) {
    try {
      return await prisma.eventRegistration.findUnique({
        where: { memberId_eventId: { memberId, eventId } },
        include: {
          member: {
            include: {
              attributes: {
                include: { definition: true },
                where: { definition: { eventId } },
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
    eventId: string,
    memberId: string,
    data: Record<string, unknown>,
  ) {
    try {
      return await prisma.eventRegistration.update({
        where: { memberId_eventId: { memberId, eventId } },
        data: data as any,
        include: { member: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update registration");
    }
  }

  async deleteRegistrationWithCleanup(eventId: string, memberId: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        const memberSwaps = await tx.swapRequest.findMany({
          where: {
            requesterId: memberId,
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
          where: { teamMemberId: memberId, shift: { eventId } },
        });

        await tx.shiftPreference.deleteMany({
          where: { teamMemberId: memberId, shift: { eventId } },
        });

        return tx.eventRegistration.delete({
          where: { memberId_eventId: { memberId, eventId } },
        });
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to delete registration");
    }
  }
}
