import { TeamMemberRepository } from "@/lib/repositories/team-member.repository";
import type { Prisma } from "@prisma/client";

export class MembersService {
  private repo: TeamMemberRepository;

  constructor(repo?: TeamMemberRepository) {
    this.repo = repo || new TeamMemberRepository();
  }

  async listMembers() {
    return this.repo.findAll();
  }

  async getMember(id: string) {
    return this.repo.findById(id);
  }

  async createMember(data: { name: string; emoji: string }) {
    return this.repo.create(data);
  }

  async updateMember(id: string, data: Prisma.TeamMemberUpdateInput) {
    return this.repo.update(id, data);
  }

  async deleteMember(id: string) {
    return this.repo.delete(id);
  }
}
