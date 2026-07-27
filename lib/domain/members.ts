import { TeamMemberRepository } from "@/lib/repositories/team-member.repository";

const memberRepo = new TeamMemberRepository();

export async function permanentDeleteMember(id: string) {
  const member = await memberRepo.findById(id);
  if (member?.isActive) {
    throw new Error("MEMBER_STILL_ACTIVE");
  }
  return memberRepo.permanentDelete(id);
}
