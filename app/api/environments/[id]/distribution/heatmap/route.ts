import { withAuth } from "@/lib/api/withAuth";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { createSuccessResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { EnvironmentRepository } from "@/lib/repositories/environment.repository";
import { TeamMemberRepository } from "@/lib/repositories/team-member.repository";

const environmentRepo = new EnvironmentRepository();
const memberRepo = new TeamMemberRepository();

export const GET = withAuth(withErrorHandling(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id: environmentId } = await params;

  const event = await environmentRepo.findById(environmentId);
  const config = event.config as Record<string, unknown> | null;

  const shifts = await prisma.shift.findMany({
    where: { environmentId },
    include: {
      preferences: { include: { teamMember: true } },
      assignments: { include: { teamMember: true } },
      requiredRoles: true,
      environment: { select: { id: true, startDate: true, endDate: true } },
    },
    orderBy: { startTime: "asc" },
  });

  const registrations = await prisma.environmentRegistration.findMany({
    where: { environmentId },
    include: { member: true },
    orderBy: { member: { alias: "asc" } },
  });

  const members = await Promise.all(
    registrations.map(async (reg) => {
      const attrs = await memberRepo.getAttributes(reg.member.id, environmentId);
      const attrMap: Record<string, string> = {};
      for (const attr of attrs) {
        attrMap[attr.definition.name] = JSON.parse(attr.value);
      }
      return {
        id: reg.member.id,
        alias: reg.member.alias,
        attributes: attrMap,
      };
    }),
  );

  const assignments = await prisma.assignment.findMany({
    where: { shift: { environmentId } },
  });

  const preferences = await prisma.shiftPreference.findMany({
    where: { shift: { environmentId } },
  });

  const allocationRules = Array.isArray(config?.allocationRules)
    ? config.allocationRules
    : [];

  const memberIds = registrations.map((r) => r.memberId);
  const crossEventRows = await prisma.assignment.findMany({
    where: { teamMemberId: { in: memberIds }, shift: { environmentId: { not: environmentId } } },
    select: {
      teamMemberId: true,
      shift: { select: { id: true, environmentId: true, startTime: true, endTime: true } },
    },
  });

  const attributeDefinitions = await prisma.attributeDefinition.findMany({
    where: { requirements: { some: { environmentId } } },
    select: { id: true, name: true, type: true, options: true },
  });

  return createSuccessResponse({
    shifts,
    members,
    assignments,
    preferences,
    config,
    allocationRules,
    crossEventAssignments: crossEventRows.map((r) => ({ memberId: r.teamMemberId, shift: r.shift })),
    attributeDefinitions,
  });
}));
