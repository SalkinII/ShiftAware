import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";

export class EventConfigRepository extends BaseRepository {
  async getConfig(eventId: string) {
    try {
      return await prisma.eventConfig.findUnique({
        where: { eventId },
        include: {
          event: {
            select: {
              id: true,
              name: true,
              startDate: true,
              endDate: true,
              status: true,
            },
          },
        },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch event config");
    }
  }

  async upsertConfig(eventId: string, data: Record<string, unknown>) {
    try {
      return await prisma.eventConfig.upsert({
        where: { eventId },
        update: data as any,
        create: { eventId, ...data } as any,
        include: {
          event: {
            select: {
              id: true,
              name: true,
              startDate: true,
              endDate: true,
              status: true,
            },
          },
        },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to upsert event config");
    }
  }
}
