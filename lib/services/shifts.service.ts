import { ShiftRepository } from "@/lib/repositories/shift.repository";
import { assertEventStatusAllows } from "@/lib/services/event-status-guard";
import type { Prisma } from "@prisma/client";

export class ShiftsService {
  private repo: ShiftRepository;

  constructor(repo?: ShiftRepository) {
    this.repo = repo || new ShiftRepository();
  }

  async listShifts(where?: Prisma.ShiftWhereInput) {
    return this.repo.findAll(where);
  }

  async getShift(id: string) {
    return this.repo.findById(id);
  }

  async createShift(data: Prisma.ShiftCreateInput) {
    const eventId =
      (data as { eventId?: string }).eventId ??
      (data.event as { connect?: { id: string } })?.connect?.id;
    if (eventId) {
      await assertEventStatusAllows(eventId, "SHIFT_MUTATE");
    }
    return this.repo.create(data);
  }

  async updateShift(id: string, data: Prisma.ShiftUpdateInput) {
    const existing = await this.repo.findById(id);
    await assertEventStatusAllows(existing.eventId, "SHIFT_MUTATE");
    return this.repo.update(id, data);
  }

  async deleteShift(id: string) {
    const existing = await this.repo.findById(id);
    await assertEventStatusAllows(existing.eventId, "SHIFT_MUTATE");
    return this.repo.delete(id);
  }

  async updateShiftWithRoles(
    id: string,
    shiftData: Prisma.ShiftUpdateInput,
    requiredRoles?: Array<{ role: string; count: number }>,
  ) {
    const existing = await this.repo.findById(id);
    await assertEventStatusAllows(existing.eventId, "SHIFT_MUTATE");
    return this.repo.updateWithRoles(id, shiftData, requiredRoles);
  }

  async cascadeDeleteShift(id: string) {
    const existing = await this.repo.findById(id);
    await assertEventStatusAllows(existing.eventId, "SHIFT_MUTATE");
    return this.repo.cascadeDelete(id);
  }

  async listShiftsByEvent(eventId: string) {
    return this.repo.findByEvent(eventId);
  }

  async listShiftsWithDetails(where?: Prisma.ShiftWhereInput) {
    return this.repo.findAllWithDetails(where);
  }

  async getShiftWithDetails(id: string) {
    return this.repo.findByIdWithDetails(id);
  }
}
