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

  async permanentDelete(id: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        const shifts = await tx.shift.findMany({
          where: { eventId: id },
          select: { id: true },
        });
        const shiftIds = shifts.map((s) => s.id);

        if (shiftIds.length > 0) {
          const toShiftSwaps = await tx.swapRequest.findMany({
            where: { toShiftId: { in: shiftIds } },
            select: { id: true },
          });
          const toShiftSwapIds = toShiftSwaps.map((s) => s.id);

          if (toShiftSwapIds.length > 0) {
            await tx.swapRequest.updateMany({
              where: { matchedWithId: { in: toShiftSwapIds } },
              data: { matchedWithId: null },
            });
          }

          await tx.swapRequest.deleteMany({
            where: { toShiftId: { in: shiftIds } },
          });

          await tx.assignment.deleteMany({
            where: { shiftId: { in: shiftIds } },
          });

          await tx.shiftPreference.deleteMany({
            where: { shiftId: { in: shiftIds } },
          });

          await tx.shiftRole.deleteMany({
            where: { shiftId: { in: shiftIds } },
          });

          await tx.shift.deleteMany({
            where: { eventId: id },
          });
        }

        await tx.scheduledShift.deleteMany({
          where: { eventId: id },
        });

        await tx.eventConfig.deleteMany({
          where: { eventId: id },
        });

        await tx.shiftTemplate.deleteMany({
          where: { eventId: id },
        });

        return tx.event.delete({
          where: { id },
        });
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to permanently delete event");
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
}
