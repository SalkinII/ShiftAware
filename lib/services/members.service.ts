import { TeamMemberRepository } from "@/lib/repositories/team-member.repository";
import type { Prisma } from "@prisma/client";

export class MembersService {
  private repo: TeamMemberRepository;

  constructor(repo?: TeamMemberRepository) {
    this.repo = repo || new TeamMemberRepository();
  }

  async listMembers(where?: Prisma.TeamMemberWhereInput) {
    return this.repo.findAll(where);
  }

  async listMembersWithEventContext(eventId: string, includeUnregistered: boolean = false, search?: string) {
    const where: Prisma.TeamMemberWhereInput = { isActive: true };
    const include: Prisma.TeamMemberInclude = {};

    if (search) {
      where.alias = { contains: search, mode: "insensitive" };
    }

    if (includeUnregistered) {
      include.eventRegistrations = { where: { eventId } };
      include.attributes = {
        where: { definition: { eventId } },
        include: { definition: true },
      };
    } else {
      where.eventRegistrations = { some: { eventId } };
      include.eventRegistrations = { where: { eventId } };
      include.attributes = {
        where: { definition: { eventId } },
        include: { definition: true },
      };
    }

    return this.repo.findAllWithIncludes(where, include);
  }

  async getMember(id: string) {
    return this.repo.findById(id);
  }

  async createMember(data: Prisma.TeamMemberCreateInput) {
    return this.repo.create(data);
  }

  async updateMember(id: string, data: Prisma.TeamMemberUpdateInput) {
    return this.repo.update(id, data);
  }

  async deleteMember(id: string) {
    return this.repo.delete(id);
  }

  async getMemberWithRelations(id: string) {
    return this.repo.findByIdWithRelations(id);
  }

  async softDeleteMember(id: string) {
    return this.repo.softDelete(id);
  }

  // --- Attributes ---
  async getAttributes(memberId: string, eventId?: string) {
    return this.repo.getAttributes(memberId, eventId);
  }

  async findAttributeDefinition(eventId: string, name: string) {
    return this.repo.findAttributeDefinition(eventId, name);
  }

  async upsertAttribute(memberId: string, definitionId: string, value: string) {
    return this.repo.upsertAttribute(memberId, definitionId, value);
  }
}
