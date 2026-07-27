import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";

export class EventMetadataRepository extends BaseRepository {
  async listEventTemplates(eventId: string) {
    try {
      const assignments = await prisma.eventTemplate.findMany({
        where: { eventId },
        include: { template: { include: { requiredRoles: true } } },
        orderBy: { order: "asc" },
      });

      const eventSpecific = await prisma.shiftTemplate.findMany({
        where: { eventId },
        include: { requiredRoles: true },
      });

      return {
        assigned: assignments.map((a) => ({
          ...a.template,
          assignmentId: a.id,
          isGlobal: true,
          laneOrder: a.order,
        })),
        eventSpecific: eventSpecific.map((t) => ({
          ...t,
          isGlobal: false,
        })),
      };
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch event templates");
    }
  }

  async assignTemplate(eventId: string, templateId: string) {
    try {
      const count = await prisma.eventTemplate.count({ where: { eventId } });
      return await prisma.eventTemplate.create({
        data: { eventId, templateId, order: count },
        include: { template: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to assign template");
    }
  }

  async findEventTemplate(eventId: string, templateId: string) {
    try {
      return await prisma.eventTemplate.findUnique({
        where: { eventId_templateId: { eventId, templateId } },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to find event template");
    }
  }

  async deleteEventTemplate(eventId: string, templateId: string) {
    try {
      return await prisma.eventTemplate.delete({
        where: { eventId_templateId: { eventId, templateId } },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to delete event template");
    }
  }

  async reorderEventTemplates(
    eventId: string,
    entries: { templateId: string; order: number }[],
  ) {
    try {
      await Promise.all(
        entries.map((entry) =>
          prisma.eventTemplate.updateMany({
            where: { eventId, templateId: entry.templateId },
            data: { order: entry.order },
          }),
        ),
      );
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to reorder templates");
    }
  }

  async listEventAttributes(eventId: string) {
    try {
      return await prisma.eventAttributeDefinition.findMany({
        where: { eventId },
        orderBy: { createdAt: "asc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch event attributes");
    }
  }

  async createEventAttribute(eventId: string, data: Record<string, unknown>) {
    try {
      return await prisma.eventAttributeDefinition.create({
        data: { ...data, eventId } as any,
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create event attribute");
    }
  }

  async getEventAttribute(eventId: string, attrId: string) {
    try {
      return await prisma.eventAttributeDefinition.findFirst({
        where: { id: attrId, eventId },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch event attribute");
    }
  }

  async updateEventAttribute(
    eventId: string,
    attrId: string,
    data: Record<string, unknown>,
  ) {
    try {
      return await prisma.eventAttributeDefinition.update({
        where: { id: attrId },
        data: data as any,
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update event attribute");
    }
  }

  async deleteEventAttribute(eventId: string, attrId: string) {
    try {
      return await prisma.eventAttributeDefinition.delete({
        where: { id: attrId },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to delete event attribute");
    }
  }
}
