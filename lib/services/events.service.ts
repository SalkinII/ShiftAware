import { EventRepository } from "@/lib/repositories/event.repository";
import type { Prisma } from "@prisma/client";

export class EventsService {
  private repo: EventRepository;

  constructor(repo?: EventRepository) {
    this.repo = repo || new EventRepository();
  }

  async listEvents() {
    return this.repo.findAll();
  }

  async listEventsWithStats() {
    return this.repo.findAllWithStats();
  }

  async getEvent(id: string) {
    return this.repo.findById(id);
  }

  async createEvent(data: Prisma.EventCreateInput) {
    return this.repo.create(data);
  }

  async updateEvent(id: string, data: Prisma.EventUpdateInput) {
    return this.repo.update(id, data);
  }

  async deleteEvent(id: string) {
    return this.repo.delete(id);
  }

  async createEventWithConfig(
    eventData: Prisma.EventCreateInput,
    configDefaults: Record<string, unknown>,
  ) {
    return this.repo.createWithConfig(eventData, configDefaults);
  }
}
