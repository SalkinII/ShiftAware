import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";
import type { Prisma } from "@prisma/client";

export class EventRepository extends BaseRepository {
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
}
