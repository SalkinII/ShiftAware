import { prisma } from "@/lib/db";
import { BaseRepository, RepositoryError } from "./base.repository";
import type { Prisma } from "@prisma/client";

export class EventRepository extends BaseRepository {
  async findByIdWithShifts(id: string) {
    try {
      const event = await prisma.event.findUnique({
        where: { id },
        include: { shifts: { select: { id: true } }, config: true },
      });
      if (!event) {
        this.throwFormattedException("NOT_FOUND", `Event ${id} not found`);
      }
      return event;
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw this.handlePrismaError(error, "Failed to fetch event with shifts");
    }
  }

  async findById(id: string) {
    try {
      const event = await prisma.event.findUnique({
        where: { id },
        include: { config: true },
      });

      if (!event) {
        this.throwFormattedException("NOT_FOUND", `Event ${id} not found`);
      }

      return event;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      throw this.handlePrismaError(error, "Failed to fetch event");
    }
  }

  async findAll(where?: Prisma.EventWhereInput) {
    try {
      return await prisma.event.findMany({
        where,
        include: { config: true },
        orderBy: { startDate: "desc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch events");
    }
  }

  async create(data: Prisma.EventCreateInput) {
    try {
      return await prisma.event.create({
        data,
        include: { config: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create event");
    }
  }

  async update(id: string, data: Prisma.EventUpdateInput) {
    try {
      return await prisma.event.update({
        where: { id },
        data,
        include: { config: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update event");
    }
  }

  async delete(id: string) {
    try {
      return await prisma.event.delete({ where: { id } });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to delete event");
    }
  }

  async findAllWithStats() {
    try {
      return await prisma.event.findMany({
        include: {
          config: true,
          _count: {
            select: {
              shifts: true,
            },
          },
        },
        orderBy: { startDate: "desc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch events with stats");
    }
  }

  async findCurrent() {
    try {
      // Get the most recent event that's not completed
      const event = await prisma.event.findFirst({
        where: {
          status: {
            not: "COMPLETED",
          },
        },
        include: {
          config: true,
          _count: {
            select: {
              shifts: true,
            },
          },
        },
        orderBy: { startDate: "asc" },
      });

      if (event) {
        return event;
      }

      // Fallback to most recent event
      return await prisma.event.findFirst({
        include: {
          config: true,
          _count: {
            select: {
              shifts: true,
            },
          },
        },
        orderBy: { startDate: "desc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch current event");
    }
  }

  async createWithConfig(
    eventData: Prisma.EventCreateInput,
    configDefaults: Record<string, unknown>,
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        const event = await tx.event.create({
          data: eventData,
        });

        await tx.eventConfig.create({
          data: {
            eventId: event.id,
            ...(configDefaults as Prisma.EventConfigCreateWithoutEventInput),
          },
        });

        return tx.event.findUniqueOrThrow({
          where: { id: event.id },
          include: { config: true },
        });
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create event with config");
    }
  }

  // --- EventConfig ---
  async getConfig(eventId: string) {
    try {
      return await prisma.eventConfig.findUnique({
        where: { eventId },
        include: {
          event: {
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

  async upsertConfig(eventId: string, data: Record<string, unknown>) {
    try {
      return await prisma.eventConfig.upsert({
        where: { eventId },
        update: data as any,
        create: { eventId, ...data } as any,
        include: {
          event: {
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

  // --- EventRegistration ---
  async listRegistrations(eventId: string) {
    try {
      return await prisma.eventRegistration.findMany({
        where: { eventId },
        include: {
          member: {
            include: {
              attributes: {
                include: { definition: true },
                where: { definition: { eventId } },
              },
            },
          },
        },
        orderBy: { registeredAt: "asc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch registrations");
    }
  }

  async createRegistration(eventId: string, memberId: string, status: string) {
    try {
      return await prisma.eventRegistration.create({
        data: { memberId, eventId, status: status as any },
        include: { member: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create registration");
    }
  }

  async findRegistration(eventId: string, memberId: string) {
    try {
      return await prisma.eventRegistration.findUnique({
        where: { memberId_eventId: { memberId, eventId } },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to find registration");
    }
  }

  async getRegistration(eventId: string, memberId: string) {
    try {
      return await prisma.eventRegistration.findUnique({
        where: { memberId_eventId: { memberId, eventId } },
        include: {
          member: {
            include: {
              attributes: {
                include: { definition: true },
                where: { definition: { eventId } },
              },
            },
          },
        },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch registration");
    }
  }

  async updateRegistration(
    eventId: string,
    memberId: string,
    data: Record<string, unknown>,
  ) {
    try {
      return await prisma.eventRegistration.update({
        where: { memberId_eventId: { memberId, eventId } },
        data: data as any,
        include: { member: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update registration");
    }
  }

  async deleteRegistration(eventId: string, memberId: string) {
    try {
      return await prisma.eventRegistration.delete({
        where: { memberId_eventId: { memberId, eventId } },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to delete registration");
    }
  }

  // --- EventTemplate (junction) ---
  async listEventTemplates(eventId: string) {
    try {
      const assignments = await prisma.eventTemplate.findMany({
        where: { eventId },
        include: { template: { include: { requiredRoles: true } } },
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
      return await prisma.eventTemplate.create({
        data: { eventId, templateId },
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

  // --- EventAttributeDefinition ---
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
