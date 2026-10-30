import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";

export class AttributeDefinitionRepository extends BaseRepository {
  async findByFestival(festivalId: string) {
    try {
      return await prisma.attributeDefinition.findMany({
        where: { festivalId },
        orderBy: { createdAt: "asc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch attributes");
    }
  }

  async findByFestivalAndName(festivalId: string, name: string) {
    try {
      return await prisma.attributeDefinition.findFirst({
        where: { festivalId, name },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to find attribute definition");
    }
  }

  async findByIdInFestival(festivalId: string, id: string) {
    try {
      return await prisma.attributeDefinition.findFirst({
        where: { id, festivalId },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch attribute");
    }
  }

  async create(festivalId: string, data: Record<string, unknown>) {
    try {
      return await prisma.attributeDefinition.create({
        data: { ...data, festivalId } as any,
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create attribute");
    }
  }

  async update(id: string, data: Record<string, unknown>) {
    try {
      return await prisma.attributeDefinition.update({
        where: { id },
        data: data as any,
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update attribute");
    }
  }

  async findRequiredByEnvironment(environmentId: string) {
    try {
      return await prisma.attributeDefinition.findMany({
        where: { requirements: { some: { environmentId } } },
        select: { id: true, name: true, type: true, options: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch attributes");
    }
  }
}
