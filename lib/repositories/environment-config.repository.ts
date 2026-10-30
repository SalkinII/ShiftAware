import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";

export class EnvironmentConfigRepository extends BaseRepository {
  async getConfig(environmentId: string) {
    try {
      return await prisma.environmentConfig.findUnique({
        where: { environmentId },
        include: {
          environment: {
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

  async upsertConfig(environmentId: string, data: Record<string, unknown>) {
    try {
      return await prisma.environmentConfig.upsert({
        where: { environmentId },
        update: data as any,
        create: { environmentId, ...data } as any,
        include: {
          environment: {
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
