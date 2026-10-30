import { prisma } from "@/lib/db";

export async function isEnvironmentAdmin(memberId: string, environmentId: string): Promise<boolean> {
  const registration = await prisma.environmentRegistration.findUnique({
    where: { memberId_environmentId: { memberId, environmentId } },
  });
  return registration?.role === "ADMIN";
}

export async function getVisibleAttributeDefinitionIds(environmentId: string): Promise<string[]> {
  const requirements = await prisma.environmentAttributeRequirement.findMany({
    where: { environmentId },
    select: { definitionId: true },
  });
  return requirements.map((r) => r.definitionId);
}

export async function getEnvironmentRegistrantIds(environmentId: string): Promise<string[]> {
  const registrations = await prisma.environmentRegistration.findMany({
    where: { environmentId },
    select: { memberId: true },
  });
  return registrations.map((r) => r.memberId);
}
