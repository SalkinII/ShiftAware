import { ShiftRepository } from "@/lib/repositories/shift.repository";
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
    return this.repo.create(data);
  }

  async updateShift(id: string, data: Prisma.ShiftUpdateInput) {
    return this.repo.update(id, data);
  }

  async deleteShift(id: string) {
    return this.repo.delete(id);
  }

  async updateShiftWithRoles(
    id: string,
    shiftData: Prisma.ShiftUpdateInput,
    requiredRoles?: Array<{ role: string; count: number }>,
  ) {
    return this.repo.updateWithRoles(id, shiftData, requiredRoles);
  }

  async cascadeDeleteShift(id: string) {
    return this.repo.cascadeDelete(id);
  }

  async listShiftsByEvent(eventId: string) {
    return this.repo.findByEvent(eventId);
  }

  async listShiftsWithDetails(where?: any) {
    return this.repo.findAllWithDetails(where);
  }

  async getShiftWithDetails(id: string) {
    return this.repo.findByIdWithDetails(id);
  }
}
