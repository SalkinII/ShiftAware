import { EventRepository } from "@/lib/repositories/event.repository";
import { assertEventStatusAllows } from "@/lib/services/event-status-guard";
import {
  isValidTransition,
  STATUS_ORDER,
} from "@/lib/validations/event-transition";
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

  async getCurrentEvent() {
    return this.repo.findCurrent();
  }

  async getEvent(id: string) {
    return this.repo.findById(id);
  }

  async createEvent(data: Prisma.EventCreateInput) {
    return this.repo.create(data);
  }

  async updateEvent(id: string, data: Prisma.EventUpdateInput) {
    await assertEventStatusAllows(id, "EVENT_MUTATE");
    return this.repo.update(id, data);
  }

  async deleteEvent(id: string) {
    return this.repo.delete(id);
  }

  async transitionStatus(eventId: string, targetStatus: string) {
    const event = await this.repo.findByIdWithShifts(eventId);

    if (!isValidTransition(event.status, targetStatus)) {
      throw new Error(
        `Invalid transition: cannot go from ${event.status} to ${targetStatus}`,
      );
    }

    // Forward-transition prerequisites
    const currentIdx = STATUS_ORDER.indexOf(event.status);
    const targetIdx = STATUS_ORDER.indexOf(targetStatus);
    const isForward = targetIdx > currentIdx;

    if (isForward) {
      if (
        event.status === "PLANNING" &&
        targetStatus === "OPEN_FOR_PREFERENCES"
      ) {
        if (!event.shifts || event.shifts.length === 0) {
          throw new Error("Cannot publish: event must have at least 1 shift");
        }
      }
    }

    return this.repo.update(eventId, {
      status: targetStatus as Prisma.EventUpdateInput["status"],
    });
  }

  async createEventWithConfig(
    eventData: Prisma.EventCreateInput,
    configDefaults: Record<string, unknown>,
  ) {
    return this.repo.createWithConfig(eventData, configDefaults);
  }

  // --- Config ---
  async getConfig(eventId: string) {
    return this.repo.getConfig(eventId);
  }

  async upsertConfig(eventId: string, data: Record<string, unknown>) {
    return this.repo.upsertConfig(eventId, data);
  }

  // --- Registrations ---
  async listRegistrations(eventId: string) {
    return this.repo.listRegistrations(eventId);
  }

  async createRegistration(eventId: string, memberId: string, status: string) {
    return this.repo.createRegistration(eventId, memberId, status);
  }

  async findRegistration(eventId: string, memberId: string) {
    return this.repo.findRegistration(eventId, memberId);
  }

  async getRegistration(eventId: string, memberId: string) {
    return this.repo.getRegistration(eventId, memberId);
  }

  async updateRegistration(
    eventId: string,
    memberId: string,
    data: Record<string, unknown>,
  ) {
    return this.repo.updateRegistration(eventId, memberId, data);
  }

  async deleteRegistration(eventId: string, memberId: string) {
    return this.repo.deleteRegistration(eventId, memberId);
  }

  // --- Event Templates ---
  async listEventTemplates(eventId: string) {
    return this.repo.listEventTemplates(eventId);
  }

  async assignTemplate(eventId: string, templateId: string) {
    return this.repo.assignTemplate(eventId, templateId);
  }

  async findEventTemplate(eventId: string, templateId: string) {
    return this.repo.findEventTemplate(eventId, templateId);
  }

  async unassignTemplate(eventId: string, templateId: string) {
    return this.repo.deleteEventTemplate(eventId, templateId);
  }

  // --- Attributes ---
  async listEventAttributes(eventId: string) {
    return this.repo.listEventAttributes(eventId);
  }

  async createEventAttribute(eventId: string, data: Record<string, unknown>) {
    return this.repo.createEventAttribute(eventId, data);
  }

  async getEventAttribute(eventId: string, attrId: string) {
    return this.repo.getEventAttribute(eventId, attrId);
  }

  async updateEventAttribute(
    eventId: string,
    attrId: string,
    data: Record<string, unknown>,
  ) {
    return this.repo.updateEventAttribute(eventId, attrId, data);
  }

  async deleteEventAttribute(eventId: string, attrId: string) {
    return this.repo.deleteEventAttribute(eventId, attrId);
  }
}
