import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";
import type { Prisma } from "@prisma/client";

export class PreferenceRepository extends BaseRepository {
  async findById(id: string) {
    try {
      const preference = await prisma.shiftPreference.findUnique({
        where: { id },
        include: { teamMember: true, shift: true },
      });

      if (!preference) {
        this.throwFormattedException("NOT_FOUND", `Preference ${id} not found`);
      }

      return preference;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      throw this.handlePrismaError(error, "Failed to fetch preference");
    }
  }

  async findAll(where?: Prisma.ShiftPreferenceWhereInput) {
    try {
      return await prisma.shiftPreference.findMany({
        where,
        include: { teamMember: true, shift: true },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch preferences");
    }
  }

  async create(data: Prisma.ShiftPreferenceCreateInput) {
    try {
      return await prisma.shiftPreference.create({
        data,
        include: { teamMember: true, shift: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create preference");
    }
  }

  async update(id: string, data: Prisma.ShiftPreferenceUpdateInput) {
    try {
      return await prisma.shiftPreference.update({
        where: { id },
        data,
        include: { teamMember: true, shift: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update preference");
    }
  }

  async delete(id: string) {
    try {
      return await prisma.shiftPreference.delete({ where: { id } });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to delete preference");
    }
  }
}
