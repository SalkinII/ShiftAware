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
}
