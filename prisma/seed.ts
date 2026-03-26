import {
  AttributeType,
  EventStatus,
  PreferenceLevel,
  PrismaClient,
  Role,
  ShiftPriority,
  ShiftType,
} from "@prisma/client";

const prisma = new PrismaClient();

const EVENT_NAME = "Starlight Meadow Festival 2026";
const EVENT_START = new Date("2026-06-20T00:00:00.000Z");
const EVENT_END = new Date("2026-06-24T23:59:59.000Z");

// 10 members — mix JUNIOR/INTERMEDIATE/SENIOR, varied genders
const memberGenders: Record<string, string> = {
  Bunny: "FINTA",
  Otter: "M",
  Chipmunk: "FINTA",
  Hedgehog: "M",
  Squirrel: "FINTA",
  Robin: "M",
  Finch: "FINTA",
  Duckling: "M",
  Wolf: "M",
  Bear: "FINTA",
};

const teamMembers = [
  {
    alias: "Bunny",
    avatarId: "🐰",
    experienceLevel: "JUNIOR" as const,
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Otter",
    avatarId: "🦦",
    experienceLevel: "JUNIOR" as const,
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Chipmunk",
    avatarId: "🐿️",
    experienceLevel: "JUNIOR" as const,
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Hedgehog",
    avatarId: "🦔",
    experienceLevel: "INTERMEDIATE" as const,
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Squirrel",
    avatarId: "🐿️",
    experienceLevel: "INTERMEDIATE" as const,
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Robin",
    avatarId: "🐦",
    experienceLevel: "INTERMEDIATE" as const,
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Finch",
    avatarId: "🐦",
    experienceLevel: "INTERMEDIATE" as const,
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Duckling",
    avatarId: "🦆",
    experienceLevel: "SENIOR" as const,
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD],
  },
  {
    alias: "Wolf",
    avatarId: "🐺",
    experienceLevel: "SENIOR" as const,
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER],
  },
  {
    alias: "Bear",
    avatarId: "🐻",
    experienceLevel: "SENIOR" as const,
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD],
  },
];

async function resetForSeed() {
  await prisma.swapRequest.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.shiftPreference.deleteMany();
  await prisma.teamMemberAttribute.deleteMany();
  await prisma.eventAttributeDefinition.deleteMany();
  await prisma.eventRegistration.deleteMany();
  await prisma.shiftRole.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.scheduledShift.deleteMany();
  await prisma.eventTemplate.deleteMany();
  await prisma.shiftTemplateRole.deleteMany();
  await prisma.shiftTemplate.deleteMany();
  await prisma.eventConfig.deleteMany();
  await prisma.event.deleteMany();
  await prisma.teamMember.deleteMany();
}

async function seedTeam() {
  for (const member of teamMembers) {
    await prisma.teamMember.upsert({
      where: { alias: member.alias },
      update: {
        avatarId: member.avatarId,
        experienceLevel: member.experienceLevel,
        capabilities: member.capabilities,
        isActive: true,
      },
      create: {
        alias: member.alias,
        avatarId: member.avatarId,
        experienceLevel: member.experienceLevel,
        capabilities: member.capabilities,
      },
    });
  }
}

async function seedEvent() {
  const event = await prisma.event.create({
    data: {
      name: EVENT_NAME,
      startDate: EVENT_START,
      endDate: EVENT_END,
      status: EventStatus.OPEN_FOR_PREFERENCES,
      config: {
        create: {
          minShiftsPerPerson: 2,
          algorithmWeights: {
            preferenceMatch: 0.35,
            experienceBalance: 0.25,
            workloadFairness: 0.15,
            coreShiftCoverage: 0.05,
          },
          balanceThresholds: {},
          autoAssignUnfilled: true,
        },
      },
    },
  });
  return event;
}

async function seedEventAttributeDefinitions(eventId: string) {
  const genderDef = await prisma.eventAttributeDefinition.create({
    data: {
      eventId,
      name: "gender",
      label: "Gender",
      type: AttributeType.SELECT,
      options: ["FINTA", "M"],
      required: true,
    },
  });

  const canDriveDef = await prisma.eventAttributeDefinition.create({
    data: {
      eventId,
      name: "can_drive",
      label: "Can Drive",
      type: AttributeType.BOOLEAN,
      options: [],
      required: false,
    },
  });

  return { genderDef, canDriveDef };
}

// 3 templates: Mobile Night (MOBILE_TEAM), Stationary Day (STATIONARY), Super Shift (SUPER)
async function seedShiftTemplates() {
  const templates = [
    {
      name: "Mobile Night",
      type: ShiftType.MOBILE_TEAM,
      allowedLanes: [ShiftType.MOBILE_TEAM],
      durationMinutes: 360,
      startTime: "00:00",
      priority: ShiftPriority.CORE,
      desirabilityScore: 1,
      capacity: 2,
      color: "#1e3a8a",
      requiredRoles: [{ role: Role.TEAM_MEMBER, count: 2 }],
    },
    {
      name: "Stationary Day",
      type: ShiftType.STATIONARY,
      allowedLanes: [ShiftType.STATIONARY],
      durationMinutes: 360,
      startTime: "08:00",
      priority: ShiftPriority.CORE,
      desirabilityScore: 3,
      capacity: 3,
      color: "#f59e0b",
      requiredRoles: [
        { role: Role.SHIFT_LEAD, count: 1 },
        { role: Role.TEAM_MEMBER, count: 2 },
      ],
    },
    {
      name: "Super Shift",
      type: ShiftType.SUPER,
      allowedLanes: [ShiftType.SUPER],
      durationMinutes: 720,
      startTime: "08:00",
      priority: ShiftPriority.CORE,
      desirabilityScore: 3,
      capacity: 1,
      color: "#8b5cf6",
      requiredRoles: [{ role: Role.SUPER, count: 1 }],
    },
  ];

  const created = [];
  for (const t of templates) {
    const { requiredRoles, ...data } = t;
    const createdTemplate = await prisma.shiftTemplate.create({
      data: {
        ...data,
        requiredRoles: { create: requiredRoles },
      },
    });
    created.push(createdTemplate);
  }
  return created;
}

async function seedEventTemplates(eventId: string, templateIds: string[]) {
  for (const templateId of templateIds) {
    await prisma.eventTemplate.create({
      data: { eventId, templateId },
    });
  }
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return { hours, minutes };
}

// 15 shifts — 3 templates x 5 days, each with templateId
async function seedShifts(
  eventId: string,
  templates: {
    id: string;
    startTime: string;
    durationMinutes: number;
    type: ShiftType;
    priority: ShiftPriority;
    desirabilityScore: number;
    capacity: number;
    requiredRoles: { role: Role; count: number }[];
  }[],
) {
  const shifts = [];
  const currentDate = new Date(EVENT_START);

  for (let day = 0; day < 5; day++) {
    const dateStr = new Date(currentDate);
    dateStr.setDate(currentDate.getDate() + day);

    for (const template of templates) {
      const { hours, minutes } = parseTime(template.startTime);
      const startTime = new Date(dateStr);
      startTime.setHours(hours, minutes, 0, 0);

      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + template.durationMinutes);
      if (endTime < startTime) endTime.setDate(endTime.getDate() + 1);

      const shift = await prisma.shift.create({
        data: {
          eventId,
          type: template.type,
          templateId: template.id,
          startTime,
          endTime,
          durationMinutes: template.durationMinutes,
          priority: template.priority,
          desirabilityScore: template.desirabilityScore,
          capacity: template.capacity,
          isTemplate: false,
          requiredRoles: {
            create: template.requiredRoles.map((r) => ({
              role: r.role,
              count: r.count,
            })),
          },
        },
      });
      shifts.push(shift);
    }
  }

  return shifts;
}

async function seedEventRegistrations(eventId: string) {
  const members = await prisma.teamMember.findMany();
  for (const member of members) {
    await prisma.eventRegistration.create({
      data: { eventId, memberId: member.id, status: "REGISTERED" },
    });
  }
}

async function seedTeamMemberAttributes(
  eventId: string,
  genderDefId: string,
  canDriveDefId: string,
) {
  const members = await prisma.teamMember.findMany();
  for (const member of members) {
    const genderValue = memberGenders[member.alias] ?? "FINTA";
    await prisma.teamMemberAttribute.upsert({
      where: {
        memberId_definitionId: {
          memberId: member.id,
          definitionId: genderDefId,
        },
      },
      update: { value: JSON.stringify(genderValue) },
      create: {
        memberId: member.id,
        definitionId: genderDefId,
        value: JSON.stringify(genderValue),
      },
    });

    const canDrive = Math.random() > 0.3;
    await prisma.teamMemberAttribute.upsert({
      where: {
        memberId_definitionId: {
          memberId: member.id,
          definitionId: canDriveDefId,
        },
      },
      update: { value: JSON.stringify(canDrive) },
      create: {
        memberId: member.id,
        definitionId: canDriveDefId,
        value: JSON.stringify(canDrive),
      },
    });
  }
}

// 2-4 WANT preferences per member across core shifts
async function seedPreferences(eventId: string) {
  const members = await prisma.teamMember.findMany();
  const allShifts = await prisma.shift.findMany({
    where: { eventId },
    orderBy: { startTime: "asc" },
  });
  const coreShifts = allShifts.filter((s) => s.priority === ShiftPriority.CORE);

  for (const member of members) {
    const count = 2 + Math.floor(Math.random() * 3);
    const preferred = coreShifts
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(count, coreShifts.length));

    for (const shift of preferred) {
      await prisma.shiftPreference.upsert({
        where: {
          teamMemberId_shiftId: { teamMemberId: member.id, shiftId: shift.id },
        },
        update: { wantLevel: PreferenceLevel.WANT },
        create: {
          teamMemberId: member.id,
          shiftId: shift.id,
          wantLevel: PreferenceLevel.WANT,
        },
      });
    }
  }
}

async function seedSystemConfig() {
  await prisma.systemConfig.upsert({
    where: { key: "session_timeout_minutes" },
    update: { value: 60 },
    create: { key: "session_timeout_minutes", value: 60 },
  });

  await prisma.systemConfig.upsert({
    where: { key: "default_avatar_set" },
    update: { value: teamMembers.map((t) => t.avatarId) },
    create: {
      key: "default_avatar_set",
      value: teamMembers.map((t) => t.avatarId),
    },
  });
}

async function main() {
  await resetForSeed();

  await seedTeam();
  console.log(`✓ Seeded ${teamMembers.length} team members`);

  const event = await seedEvent();
  console.log(`✓ Seeded event: ${event.name}`);

  const { genderDef, canDriveDef } = await seedEventAttributeDefinitions(
    event.id,
  );
  console.log(`✓ Seeded 2 event attribute definitions`);

  const templates = await seedShiftTemplates();
  console.log(`✓ Seeded ${templates.length} shift templates`);

  await seedEventTemplates(
    event.id,
    templates.map((t) => t.id),
  );
  console.log(`✓ Seeded ${templates.length} event-template assignments`);

  const templatesWithRoles = await prisma.shiftTemplate.findMany({
    where: { id: { in: templates.map((t) => t.id) } },
    include: { requiredRoles: true },
  });

  const shifts = await seedShifts(
    event.id,
    templatesWithRoles.map((t) => ({
      id: t.id,
      startTime: t.startTime,
      durationMinutes: t.durationMinutes,
      type: t.type,
      priority: ShiftPriority.CORE,
      desirabilityScore: t.desirabilityScore,
      capacity: t.capacity,
      requiredRoles: t.requiredRoles.map((r) => ({
        role: r.role,
        count: r.count,
      })),
    })),
  );
  console.log(`✓ Seeded ${shifts.length} shifts`);

  await seedEventRegistrations(event.id);
  const regCount = await prisma.eventRegistration.count({
    where: { eventId: event.id },
  });
  console.log(`✓ Seeded ${regCount} event registrations`);

  await seedTeamMemberAttributes(event.id, genderDef.id, canDriveDef.id);
  const attrCount = await prisma.teamMemberAttribute.count();
  console.log(`✓ Seeded ${attrCount} team member attributes`);

  await seedPreferences(event.id);
  const prefCount = await prisma.shiftPreference.count();
  console.log(`✓ Seeded ${prefCount} preferences`);

  await seedSystemConfig();
  console.log(`✓ Seeded system config`);
}

main()
  .then(async () => {
    console.log("✓ Seed data written");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
