import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";
import type { Prisma } from "@prisma/client";

export class ShiftRepository extends BaseRepository {
  async findById(id: string) {
    try {
      const shift = await prisma.shift.findUnique({
        where: { id },
        include: { requiredRoles: true, preferences: true },
      });

      if (!shift) {
        this.throwFormattedException("NOT_FOUND", `Shift ${id} not found`);
      }

      return shift;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      throw this.handlePrismaError(error, "Failed to fetch shift");
    }
  }

  async findAll(where?: Prisma.ShiftWhereInput) {
    try {
      return await prisma.shift.findMany({
        where,
        include: { requiredRoles: true, preferences: true },
        orderBy: { startTime: "asc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch shifts");
    }
  }

  async create(data: Prisma.ShiftCreateInput) {
    try {
      return await prisma.shift.create({
        data,
        include: { requiredRoles: true, preferences: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create shift");
    }
  }

  async update(id: string, data: Prisma.ShiftUpdateInput) {
    try {
      return await prisma.shift.update({
        where: { id },
        data,
        include: { requiredRoles: true, preferences: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update shift");
    }
  }

  async delete(id: string) {
    try {
      return await prisma.shift.delete({ where: { id } });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to delete shift");
    }
  }
}
