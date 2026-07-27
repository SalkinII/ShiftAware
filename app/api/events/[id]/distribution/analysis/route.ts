import { withAuth } from "@/lib/api/withAuth";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { createSuccessResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { EventRepository } from "@/lib/repositories/event.repository";

const eventRepo = new EventRepository();

export const GET = withAuth(withErrorHandling(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id: eventId } = await params;

  const event = await eventRepo.findById(eventId);
  const config = event.config as any;
  const maxShifts = config?.balanceThresholds?.maxShiftsPerPerson ?? Infinity;
  const minShifts = config?.minShiftsPerPerson ?? 0;

  const registrations = await prisma.eventRegistration.findMany({
    where: { eventId },
    include: {
      member: {
        include: {
          assignments: { where: { shift: { eventId } }, include: { shift: true } },
          attributes: { where: { definition: { eventId } }, include: { definition: true } },
        },
      },
    },
  });

  const members = registrations.map((reg) => {
    const m = reg.member;
    const assignedCount = m.assignments.length;
    const violations: string[] = [];
    if (assignedCount < minShifts) violations.push(`Below minimum (${assignedCount}/${minShifts})`);
    if (assignedCount > maxShifts) violations.push(`Exceeds maximum (${assignedCount}/${maxShifts})`);
    const byType: Record<string, number> = {};
    for (const a of m.assignments) {
      const type = a.shift.type || "unknown";
      byType[type] = (byType[type] ?? 0) + 1;
    }
    const attrMap: Record<string, string> = {};
    for (const attr of m.attributes) {
      attrMap[attr.definition.name] = JSON.parse(attr.value);
    }
    return {
      id: m.id,
      alias: m.alias,
      avatarId: m.avatarId,
      assignedCount,
      minShifts,
      maxShifts,
      byType,
      attributes: attrMap,
      violations,
    };
  });

  return createSuccessResponse({ members, eventId });
}));
