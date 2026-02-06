import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";
import type { Prisma } from "@prisma/client";

export class ShiftTemplateRepository extends BaseRepository {
  async findById(id: string) {
    try {
      const template = await prisma.shiftTemplate.findUnique({
        where: { id },
        include: { requiredRoles: true },
      });
      if (!template) {
        this.throwFormattedException("NOT_FOUND", `Template ${id} not found`);
      }
      return template;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found"))
        throw error;
      throw this.handlePrismaError(error, "Failed to fetch template");
    }
  }

  async findAll(where?: Prisma.ShiftTemplateWhereInput) {
    try {
      return await prisma.shiftTemplate.findMany({
        where,
        include: { requiredRoles: true },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch templates");
    }
  }

  async findForEvent(eventId: string, includeGlobal: boolean) {
    try {
      let where: Prisma.ShiftTemplateWhereInput;

      if (includeGlobal) {
        const assignments = await prisma.eventTemplate.findMany({
          where: { eventId },
          select: { templateId: true },
        });
        const assignedIds = assignments.map((a) => a.templateId);
        where = {
          OR: [{ id: { in: assignedIds } }, { eventId }],
        };
      } else {
        where = { eventId };
      }

      return await prisma.shiftTemplate.findMany({
        where,
        include: { requiredRoles: true },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch event templates");
    }
  }

  async findGlobal() {
    try {
      return await prisma.shiftTemplate.findMany({
        where: { eventId: null },
        include: { requiredRoles: true },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch global templates");
    }
  }

  async create(data: Prisma.ShiftTemplateCreateInput) {
    try {
      return await prisma.shiftTemplate.create({
        data,
        include: { requiredRoles: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create template");
    }
  }

  async updateWithRoles(
    id: string,
    data: Record<string, unknown>,
    requiredRoles: Array<{ role: string; count: number }>,
  ) {
    try {
      return await prisma.shiftTemplate.update({
        where: { id },
        data: {
          ...data,
          requiredRoles: {
            deleteMany: {},
            create: requiredRoles as any,
          },
        },
        include: { requiredRoles: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update template");
    }
  }

  async delete(id: string) {
    try {
      return await prisma.shiftTemplate.delete({ where: { id } });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to delete template");
    }
  }

  async createScheduledShift(templateId: string, eventId: string, date: Date) {
    try {
      return await prisma.scheduledShift.create({
        data: { templateId, eventId, date },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create scheduled shift");
    }
  }
}
