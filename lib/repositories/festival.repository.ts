import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";

export type FestivalSummary = { id: string; name: string; startDate: Date; endDate: Date };

const festivalSummary = { id: true, name: true, startDate: true, endDate: true } as const;

export class FestivalRepository extends BaseRepository {
  async findAll(): Promise<FestivalSummary[]> {
    try {
      return await prisma.festival.findMany({
        select: festivalSummary,
        orderBy: { startDate: "desc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch festivals");
    }
  }

  async findById(id: string): Promise<FestivalSummary | null> {
    try {
      return await prisma.festival.findUnique({
        where: { id },
        select: festivalSummary,
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch festival");
    }
  }

  async create(data: { name: string; startDate: Date; endDate: Date }): Promise<FestivalSummary> {
    try {
      return await prisma.festival.create({ data, select: festivalSummary });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create festival");
    }
  }

  async update(
    id: string,
    data: Partial<{ name: string; startDate: Date; endDate: Date }>,
  ): Promise<FestivalSummary> {
    try {
      return await prisma.festival.update({ where: { id }, data, select: festivalSummary });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update festival");
    }
  }
}
