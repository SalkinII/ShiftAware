import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";

export class MarkerRepository extends BaseRepository {
  async findByEvent(eventId: string) {
    try {
      return await prisma.planMarker.findMany({
        where: { eventId },
        orderBy: { startTime: "asc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch markers");
    }
  }

  async create(data: { eventId: string; text: string; startTime: Date; endTime: Date }) {
    try {
      return await prisma.planMarker.create({ data });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create marker");
    }
  }

  async update(id: string, data: Partial<{ text: string; startTime: Date; endTime: Date }>) {
    try {
      return await prisma.planMarker.update({ where: { id }, data });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update marker");
    }
  }

  async delete(id: string) {
    try {
      return await prisma.planMarker.delete({ where: { id } });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to delete marker");
    }
  }

  async findById(id: string) {
    try {
      const marker = await prisma.planMarker.findUnique({ where: { id } });
      if (!marker) this.throwFormattedException("NOT_FOUND", "Marker not found");
      return marker!;
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch marker");
    }
  }
}
