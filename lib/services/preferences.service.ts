import { prisma } from "@/lib/db";
import { PreferenceRepository } from "@/lib/repositories/preference.repository";
import { assertEventStatusAllows } from "@/lib/services/event-status-guard";
import type { Prisma } from "@prisma/client";

export class PreferencesService {
  private repo: PreferenceRepository;

  constructor(repo?: PreferenceRepository) {
    this.repo = repo || new PreferenceRepository();
  }

  async listPreferences(where?: Prisma.ShiftPreferenceWhereInput) {
    return this.repo.findAll(where);
  }

  async getPreference(id: string) {
    return this.repo.findById(id);
  }

  async createPreference(data: Prisma.ShiftPreferenceCreateInput) {
    const shiftId =
      (data as { shiftId?: string }).shiftId ??
      (data.shift as { connect?: { id: string } })?.connect?.id;
    if (shiftId) {
      const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        select: { eventId: true },
      });
      if (shift) {
        await assertEventStatusAllows(shift.eventId, "PREFERENCE_MUTATE");
      }
    }
    return this.repo.create(data);
  }

  async updatePreference(id: string, data: Prisma.ShiftPreferenceUpdateInput) {
    const existing = await this.repo.findById(id);
    await assertEventStatusAllows(existing.shift.eventId, "PREFERENCE_MUTATE");
    return this.repo.update(id, data);
  }

  async deletePreference(id: string) {
    const existing = await this.repo.findById(id);
    await assertEventStatusAllows(existing.shift.eventId, "PREFERENCE_MUTATE");
    return this.repo.delete(id);
  }

  async upsertPreference(data: {
    teamMemberId: string;
    shiftId: string;
    wantLevel: string;
    notes?: string | null;
  }) {
    const shift = await prisma.shift.findUnique({
      where: { id: data.shiftId },
      select: { eventId: true },
    });
    if (shift) {
      await assertEventStatusAllows(shift.eventId, "PREFERENCE_MUTATE");
    }
    return this.repo.upsert(data);
  }

  async deleteByCompoundKey(teamMemberId: string, shiftId: string) {
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      select: { eventId: true },
    });
    if (shift) {
      await assertEventStatusAllows(shift.eventId, "PREFERENCE_MUTATE");
    }
    return this.repo.deleteByCompoundKey(teamMemberId, shiftId);
  }

  async listPreferencesWithDetails(filters?: {
    teamMemberId?: string;
    shiftId?: string;
  }) {
    const where: any = {};
    if (filters?.teamMemberId) where.teamMemberId = filters.teamMemberId;
    if (filters?.shiftId) where.shiftId = filters.shiftId;
    return this.repo.findAllWithDetails(
      Object.keys(where).length > 0 ? where : undefined,
    );
  }
}
