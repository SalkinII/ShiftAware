import { withAuth } from "@/lib/api/withAuth";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { createSuccessResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { EventRepository } from "@/lib/repositories/event.repository";
import { TeamMemberRepository } from "@/lib/repositories/team-member.repository";

const eventRepo = new EventRepository();
const memberRepo = new TeamMemberRepository();

export const GET = withAuth(withErrorHandling(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id: eventId } = await params;

  const event = await eventRepo.findById(eventId);
  const config = event.config as Record<string, unknown> | null;

  const shifts = await prisma.shift.findMany({
    where: { eventId },
    include: {
      preferences: { include: { teamMember: true } },
      assignments: { include: { teamMember: true } },
      requiredRoles: true,
      event: { select: { id: true, startDate: true, endDate: true } },
    },
    orderBy: { startTime: "asc" },
  });

  const registrations = await prisma.eventRegistration.findMany({
    where: { eventId },
    include: { member: true },
    orderBy: { member: { alias: "asc" } },
  });

  const members = await Promise.all(
    registrations.map(async (reg) => {
      const attrs = await memberRepo.getAttributes(reg.member.id, eventId);
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
    where: { shift: { eventId } },
  });

  const preferences = await prisma.shiftPreference.findMany({
    where: { shift: { eventId } },
  });

  const allocationRules = Array.isArray(config?.allocationRules)
    ? config.allocationRules
    : [];

  const memberIds = registrations.map((r) => r.memberId);
  const crossEventRows = await prisma.assignment.findMany({
    where: { teamMemberId: { in: memberIds }, shift: { eventId: { not: eventId } } },
    select: {
      teamMemberId: true,
      shift: { select: { id: true, eventId: true, startTime: true, endTime: true } },
    },
  });

  const attributeDefinitions = await prisma.eventAttributeDefinition.findMany({
    where: { eventId },
    select: { id: true, name: true, type: true },
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
