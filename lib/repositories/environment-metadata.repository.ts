import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";

export class EnvironmentMetadataRepository extends BaseRepository {
  async listEventTemplates(environmentId: string) {
    try {
      const assignments = await prisma.environmentTemplate.findMany({
        where: { environmentId },
        include: { template: { include: { requiredRoles: true } } },
        orderBy: { order: "asc" },
      });

      return {
        assigned: assignments.map((a) => ({
          ...a.template,
          assignmentId: a.id,
          isGlobal: true,
          laneOrder: a.order,
        })),
        eventSpecific: [],
      };
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch event templates");
    }
  }

  async assignTemplate(environmentId: string, templateId: string) {
    try {
      const count = await prisma.environmentTemplate.count({ where: { environmentId } });
      return await prisma.environmentTemplate.create({
        data: { environmentId, templateId, order: count },
        include: { template: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to assign template");
    }
  }

  async findEventTemplate(environmentId: string, templateId: string) {
    try {
      return await prisma.environmentTemplate.findUnique({
        where: { environmentId_templateId: { environmentId, templateId } },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to find event template");
    }
  }

  async deleteEventTemplate(environmentId: string, templateId: string) {
    try {
      return await prisma.environmentTemplate.delete({
        where: { environmentId_templateId: { environmentId, templateId } },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to delete event template");
    }
  }

  async reorderEventTemplates(
    environmentId: string,
    entries: { templateId: string; order: number }[],
  ) {
    try {
      await Promise.all(
        entries.map((entry) =>
          prisma.environmentTemplate.updateMany({
            where: { environmentId, templateId: entry.templateId },
            data: { order: entry.order },
          }),
        ),
      );
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to reorder templates");
    }
  }

  async listAttributeRequirements(environmentId: string) {
    try {
      const requirements = await prisma.environmentAttributeRequirement.findMany({
        where: { environmentId },
        include: { definition: true },
        orderBy: { createdAt: "asc" },
      });
      return requirements.map((r) => ({ ...r.definition, required: r.required }));
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch event attributes");
    }
  }

  async setAttributeRequirement(environmentId: string, definitionId: string, required: boolean) {
    try {
      return await prisma.environmentAttributeRequirement.upsert({
        where: { environmentId_definitionId: { environmentId, definitionId } },
        update: { required },
        create: { environmentId, definitionId, required },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to set attribute requirement");
    }
  }

  async removeAttributeRequirement(environmentId: string, definitionId: string) {
    try {
      return await prisma.environmentAttributeRequirement.delete({
        where: { environmentId_definitionId: { environmentId, definitionId } },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to remove attribute requirement");
    }
  }
}
