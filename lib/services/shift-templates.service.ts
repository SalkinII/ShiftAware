import { ShiftTemplateRepository } from "@/lib/repositories/shift-template.repository";
import type { Prisma } from "@prisma/client";

export class ShiftTemplatesService {
  private repo: ShiftTemplateRepository;

  constructor(repo?: ShiftTemplateRepository) {
    this.repo = repo || new ShiftTemplateRepository();
  }

  async getTemplate(id: string) {
    return this.repo.findById(id);
  }

  async listTemplates(eventId?: string, includeGlobal?: boolean) {
    if (eventId) {
      return this.repo.findForEvent(eventId, includeGlobal !== false);
    }
    return this.repo.findGlobal();
  }

  async createTemplate(data: Prisma.ShiftTemplateCreateInput) {
    return this.repo.create(data);
  }

  async updateTemplate(
    id: string,
    data: Record<string, unknown>,
    requiredRoles: Array<{ role: string; count: number }>,
  ) {
    return this.repo.updateWithRoles(id, data, requiredRoles);
  }

  async deleteTemplate(id: string) {
    return this.repo.delete(id);
  }

  async scheduleTemplate(templateId: string, eventId: string, date: Date) {
    return this.repo.createScheduledShift(templateId, eventId, date);
  }
}
