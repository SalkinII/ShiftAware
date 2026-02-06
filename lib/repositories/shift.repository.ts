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

  async updateWithRoles(
    id: string,
    shiftData: Prisma.ShiftUpdateInput,
    requiredRoles?: Array<{ role: string; count: number }>,
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Delete existing roles if new ones provided
        if (requiredRoles) {
          await tx.shiftRole.deleteMany({ where: { shiftId: id } });
        }

        const updated = await tx.shift.update({
          where: { id },
          data: shiftData,
          include: {
            requiredRoles: true,
            event: true,
          },
        });

        // Create new roles if provided
        if (requiredRoles) {
          await tx.shiftRole.createMany({
            data: requiredRoles.map((role) => ({
              shiftId: id,
              role: role.role as Prisma.Role,
              count: role.count,
            })),
          });

          // Refetch to include new roles
          return tx.shift.findUniqueOrThrow({
            where: { id },
            include: { requiredRoles: true, event: true },
          });
        }

        return updated;
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update shift with roles");
    }
  }

  async cascadeDelete(id: string) {
    try {
      // First check if shift has assignments
      const assignmentCount = await prisma.assignment.count({
        where: { shiftId: id },
      });

      if (assignmentCount > 0) {
        this.throwFormattedException(
          "CONFLICT",
          "Cannot delete shift with existing assignments",
        );
      }

      // Delete in transaction
      await prisma.$transaction(async (tx) => {
        // Delete shift roles
        await tx.shiftRole.deleteMany({
          where: { shiftId: id },
        });

        // Delete shift preferences
        await tx.shiftPreference.deleteMany({
          where: { shiftId: id },
        });

        // Finally delete the shift
        await tx.shift.delete({
          where: { id },
        });
      });

      return { success: true };
    } catch (error) {
      if (error instanceof Error && error.message.includes("assignments")) {
        throw error;
      }
      throw this.handlePrismaError(error, "Failed to cascade delete shift");
    }
  }
}
