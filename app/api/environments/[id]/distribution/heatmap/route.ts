import { withAuth } from "@/lib/api/withAuth";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { createSuccessResponse } from "@/lib/api-errors";
import { EnvironmentRepository } from "@/lib/repositories/environment.repository";
import { TeamMemberRepository } from "@/lib/repositories/team-member.repository";
import { ShiftRepository } from "@/lib/repositories/shift.repository";
import { AssignmentRepository } from "@/lib/repositories/assignment.repository";
import { EnvironmentRegistrationRepository } from "@/lib/repositories/environment-registration.repository";
import { PreferenceRepository } from "@/lib/repositories/preference.repository";
import { AttributeDefinitionRepository } from "@/lib/repositories/attribute-definition.repository";

const environmentRepo = new EnvironmentRepository();
const memberRepo = new TeamMemberRepository();
const shiftRepo = new ShiftRepository();
const assignmentRepo = new AssignmentRepository();
const registrationRepo = new EnvironmentRegistrationRepository();
const preferenceRepo = new PreferenceRepository();
const attributeDefinitionRepo = new AttributeDefinitionRepository();

export const GET = withAuth(withErrorHandling(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id: environmentId } = await params;

  const event = await environmentRepo.findById(environmentId);
  const config = event.config as Record<string, unknown> | null;

  const shifts = await shiftRepo.findByEnvironmentWithDetails(environmentId);

  const registrations = await registrationRepo.findByEnvironmentWithMembers(environmentId);

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

  const assignments = await assignmentRepo.findByEnvironment(environmentId);

  const preferences = await preferenceRepo.findByEnvironment(environmentId);

  const allocationRules = Array.isArray(config?.allocationRules)
    ? config.allocationRules
    : [];

  const memberIds = registrations.map((r) => r.memberId);
  const crossEventRows = await assignmentRepo.findCrossEnvironment(memberIds, environmentId);

  const attributeDefinitions = await attributeDefinitionRepo.findRequiredByEnvironment(environmentId);

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
