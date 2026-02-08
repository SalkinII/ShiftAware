/**
 * Data migration: Copy TeamMember.genderRole values into TeamMemberAttribute.
 *
 * For each event:
 * 1. Ensure an EventAttributeDefinition(name="gender") exists
 * 2. For each registered member, create a TeamMemberAttribute with their genderRole value
 *
 * Run BEFORE the schema migration that removes genderRole.
 * Usage: npx tsx prisma/migrations/data-migrate-gender-role.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting genderRole data migration...");

  // Get all events
  const events = await prisma.event.findMany();
  console.log(`Found ${events.length} events`);

  for (const event of events) {
    // Ensure "gender" attribute definition exists for this event
    let genderDef = await prisma.eventAttributeDefinition.findFirst({
      where: { eventId: event.id, name: "gender" },
    });

    if (!genderDef) {
      genderDef = await prisma.eventAttributeDefinition.create({
        data: {
          eventId: event.id,
          name: "gender",
          label: "Gender",
          type: "SELECT",
          options: ["FINTA", "M"],
          required: true,
        },
      });
      console.log(
        `Created gender attribute definition for event: ${event.name}`,
      );
    }

    // Get all registered members for this event
    const registrations = await prisma.eventRegistration.findMany({
      where: { eventId: event.id },
      include: { member: true },
    });

    let migrated = 0;
    for (const reg of registrations) {
      const member = reg.member;
      // @ts-ignore - genderRole still exists in DB at this point
      const genderValue = (member as any).genderRole;

      if (!genderValue || genderValue === "unspecified") continue;

      // Upsert the attribute value
      await prisma.teamMemberAttribute.upsert({
        where: {
          memberId_definitionId: {
            memberId: member.id,
            definitionId: genderDef.id,
          },
        },
        update: { value: JSON.stringify(genderValue) },
        create: {
          memberId: member.id,
          definitionId: genderDef.id,
          value: JSON.stringify(genderValue),
        },
      });
      migrated++;
    }
    console.log(
      `Migrated ${migrated} gender attributes for event: ${event.name}`,
    );
  }

  console.log("Data migration complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
