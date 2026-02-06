import { PreferenceRepository } from "@/lib/repositories/preference.repository";
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
    return this.repo.create(data);
  }

  async updatePreference(id: string, data: Prisma.ShiftPreferenceUpdateInput) {
    return this.repo.update(id, data);
  }

  async deletePreference(id: string) {
    return this.repo.delete(id);
  }
}
