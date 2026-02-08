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
const EVENT_START_DATE = new Date("2026-06-11T00:00:00.000Z");
const EVENT_END_DATE = new Date("2026-07-08T23:59:59.000Z");
const CORE_START_DATE = new Date("2026-06-26T00:00:00.000Z");
const CORE_END_DATE = new Date("2026-06-29T23:59:59.000Z");

// Define gender values for seed members (for dynamic attribute system)
const memberGenders: Record<string, string> = {
  Bunny: "FINTA",
  Otter: "M",
  Chipmunk: "FINTA",
  Hedgehog: "M",
  Squirrel: "FINTA",
  Robin: "M",
  Finch: "FINTA",
  Duckling: "M",
  Fawn: "FINTA",
  Kitten: "M",
  Fox: "FINTA",
  Badger: "M",
  Raccoon: "FINTA",
  Panda: "M",
  Koala: "FINTA",
  Owl: "M",
  Peacock: "FINTA",
  Swan: "M",
  Deer: "FINTA",
  Lynx: "M",
  Wolf: "M",
  Bear: "FINTA",
  Eagle: "M",
  Hawk: "FINTA",
  Lion: "M",
  Tiger: "FINTA",
  Falcon: "M",
  Leopard: "FINTA",
  Panther: "M",
  Jaguar: "FINTA",
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
    genderRole: "M",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Chipmunk",
    avatarId: "🐿️",
    experienceLevel: "JUNIOR" as const,
    genderRole: "FINTA",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Hedgehog",
    avatarId: "🦔",
    experienceLevel: "JUNIOR" as const,
    genderRole: "M",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Squirrel",
    avatarId: "🐿️",
    experienceLevel: "JUNIOR" as const,
    genderRole: "FINTA",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Robin",
    avatarId: "🐦",
    experienceLevel: "JUNIOR" as const,
    genderRole: "M",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Finch",
    avatarId: "🐦",
    experienceLevel: "JUNIOR" as const,
    genderRole: "FINTA",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Duckling",
    avatarId: "🦆",
    experienceLevel: "JUNIOR" as const,
    genderRole: "M",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Fawn",
    avatarId: "🦌",
    experienceLevel: "JUNIOR" as const,
    genderRole: "FINTA",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Kitten",
    avatarId: "🐱",
    experienceLevel: "JUNIOR" as const,
    genderRole: "M",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Fox",
    avatarId: "🦊",
    experienceLevel: "INTERMEDIATE" as const,
    genderRole: "FINTA",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Badger",
    avatarId: "🦡",
    experienceLevel: "INTERMEDIATE" as const,
    genderRole: "M",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Raccoon",
    avatarId: "🦝",
    experienceLevel: "INTERMEDIATE" as const,
    genderRole: "FINTA",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Panda",
    avatarId: "🐼",
    experienceLevel: "INTERMEDIATE" as const,
    genderRole: "M",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Koala",
    avatarId: "🐨",
    experienceLevel: "INTERMEDIATE" as const,
    genderRole: "FINTA",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Owl",
    avatarId: "🦉",
    experienceLevel: "INTERMEDIATE" as const,
    genderRole: "M",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Peacock",
    avatarId: "🦚",
    experienceLevel: "INTERMEDIATE" as const,
    genderRole: "FINTA",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Swan",
    avatarId: "🦢",
    experienceLevel: "INTERMEDIATE" as const,
    genderRole: "M",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Deer",
    avatarId: "🦌",
    experienceLevel: "INTERMEDIATE" as const,
    genderRole: "FINTA",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Lynx",
    avatarId: "🐆",
    experienceLevel: "INTERMEDIATE" as const,
    genderRole: "M",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Wolf",
    avatarId: "🐺",
    experienceLevel: "SENIOR" as const,
    genderRole: "M",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER],
  },
  {
    alias: "Bear",
    avatarId: "🐻",
    experienceLevel: "SENIOR" as const,
    genderRole: "FINTA",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD],
  },
  {
    alias: "Eagle",
    avatarId: "🦅",
    experienceLevel: "SENIOR" as const,
    genderRole: "M",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER],
  },
  {
    alias: "Hawk",
    avatarId: "🦅",
    experienceLevel: "SENIOR" as const,
    genderRole: "FINTA",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD],
  },
  {
    alias: "Lion",
    avatarId: "🦁",
    experienceLevel: "SENIOR" as const,
    genderRole: "M",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER],
  },
  {
    alias: "Tiger",
    avatarId: "🐯",
    experienceLevel: "SENIOR" as const,
    genderRole: "FINTA",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER],
  },
  {
    alias: "Falcon",
    avatarId: "🦅",
    experienceLevel: "SENIOR" as const,
    genderRole: "M",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD],
  },
  {
    alias: "Leopard",
    avatarId: "🐆",
    experienceLevel: "SENIOR" as const,
    genderRole: "FINTA",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD],
  },
  {
    alias: "Panther",
    avatarId: "🐆",
    experienceLevel: "SENIOR" as const,
    genderRole: "M",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER],
  },
  {
    alias: "Jaguar",
    avatarId: "🐆",
    experienceLevel: "SENIOR" as const,
    genderRole: "FINTA",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER],
  },
];

async function resetForSeed() {
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
      startDate: EVENT_START_DATE,
      endDate: EVENT_END_DATE,
      status: EventStatus.PLANNING,
      config: {
        create: {
          minShiftsPerPerson: 2,
          algorithmWeights: {
            preferenceMatch: 0.35,
            experienceBalance: 0.25,
            workloadFairness: 0.15,
            coreShiftCoverage: 0.05,
            genderBalance: "HARD_CONSTRAINT",
          },
          balanceThresholds: {
            minGenderBalance: 0.3,
            minExperienceMix: true,
            maxConsecutiveShifts: 3,
          },
          autoAssignUnfilled: true,
          bufferDaysBefore: 1,
          bufferDaysAfter: 1,
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
      name: "Mobile Day",
      type: ShiftType.MOBILE_TEAM,
      allowedLanes: [ShiftType.MOBILE_TEAM],
      durationMinutes: 360,
      startTime: "12:00",
      priority: ShiftPriority.CORE,
      desirabilityScore: 4,
      capacity: 2,
      color: "#3b82f6",
      requiredRoles: [{ role: Role.TEAM_MEMBER, count: 2 }],
    },
    {
      name: "Stationary Morning",
      type: ShiftType.STATIONARY,
      allowedLanes: [ShiftType.STATIONARY],
      durationMinutes: 360,
      startTime: "06:00",
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
      name: "Stationary Afternoon",
      type: ShiftType.STATIONARY,
      allowedLanes: [ShiftType.STATIONARY],
      durationMinutes: 360,
      startTime: "14:00",
      priority: ShiftPriority.CORE,
      desirabilityScore: 3,
      capacity: 3,
      color: "#f97316",
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

  const createdTemplates = [];
  for (const template of templates) {
    const { requiredRoles, ...templateData } = template;
    const created = await prisma.shiftTemplate.create({
      data: {
        ...templateData,
        requiredRoles: {
          create: requiredRoles,
        },
      },
    });
    createdTemplates.push(created);
  }

  return createdTemplates;
}

async function seedEventTemplates(eventId: string, templateIds: string[]) {
  for (const templateId of templateIds) {
    await prisma.eventTemplate.create({
      data: {
        eventId,
        templateId,
      },
    });
  }
}

function isCoreDate(date: Date): boolean {
  return date >= CORE_START_DATE && date <= CORE_END_DATE;
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return { hours, minutes };
}

async function seedShiftsFromTemplates(eventId: string, templateIds: string[]) {
  const templates = await prisma.shiftTemplate.findMany({
    where: { id: { in: templateIds } },
    include: { requiredRoles: true },
  });

  const shifts = [];
  const currentDate = new Date(EVENT_START_DATE);

  while (currentDate <= EVENT_END_DATE) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const isCore = isCoreDate(currentDate);
    const priority = isCore ? ShiftPriority.CORE : ShiftPriority.BUFFER;

    for (const template of templates) {
      const { hours, minutes } = parseTime(template.startTime);
      const startTime = new Date(currentDate);
      startTime.setHours(hours, minutes, 0, 0);

      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + template.durationMinutes);

      // Handle night shifts that cross midnight
      if (endTime < startTime) {
        endTime.setDate(endTime.getDate() + 1);
      }

      const shift = await prisma.shift.create({
        data: {
          eventId,
          type: template.type,
          startTime,
          endTime,
          durationMinutes: template.durationMinutes,
          priority,
          desirabilityScore: template.desirabilityScore,
          capacity: template.capacity,
          isTemplate: false,
          requiredRoles: {
            create: template.requiredRoles.map((tr) => ({
              role: tr.role,
              count: tr.count,
            })),
          },
        },
      });

      shifts.push(shift);
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return shifts;
}

async function seedEventRegistrations(eventId: string) {
  const members = await prisma.teamMember.findMany();
  const registrations = [];

  for (const member of members) {
    const registration = await prisma.eventRegistration.create({
      data: {
        eventId,
        memberId: member.id,
        status: "REGISTERED",
      },
    });
    registrations.push(registration);
  }

  return registrations;
}

async function seedTeamMemberAttributes(
  eventId: string,
  genderDefId: string,
  canDriveDefId: string,
) {
  const members = await prisma.teamMember.findMany();

  for (const member of members) {
    // Set gender attribute from mapping
    const genderValue = memberGenders[member.alias] || "FINTA";
    await prisma.teamMemberAttribute.upsert({
      where: {
        memberId_definitionId: {
          memberId: member.id,
          definitionId: genderDefId,
        },
      },
      update: {
        value: JSON.stringify(genderValue),
      },
      create: {
        memberId: member.id,
        definitionId: genderDefId,
        value: JSON.stringify(genderValue),
      },
    });

    // Set can_drive attribute randomly (70% can drive)
    const canDrive = Math.random() > 0.3;
    await prisma.teamMemberAttribute.upsert({
      where: {
        memberId_definitionId: {
          memberId: member.id,
          definitionId: canDriveDefId,
        },
      },
      update: {
        value: JSON.stringify(canDrive),
      },
      create: {
        memberId: member.id,
        definitionId: canDriveDefId,
        value: JSON.stringify(canDrive),
      },
    });
  }
}

async function seedPreferences(eventId: string) {
  const members = await prisma.teamMember.findMany();
  const allShifts = await prisma.shift.findMany({
    where: { eventId },
    orderBy: { startTime: "asc" },
  });

  for (const member of members) {
    const coreShifts = allShifts.filter(
      (s) => s.priority === ShiftPriority.CORE,
    );
    const bufferShifts = allShifts.filter(
      (s) => s.priority === ShiftPriority.BUFFER,
    );

    const preferredCoreShifts = coreShifts
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(Math.random() * 2) + 2);

    const preferredBufferShifts = bufferShifts
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(Math.random() * 2) + 1);

    const allPreferred = [
      ...preferredCoreShifts,
      ...preferredBufferShifts,
    ].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    for (let i = 0; i < allPreferred.length; i++) {
      await prisma.shiftPreference.upsert({
        where: {
          teamMemberId_shiftId: {
            teamMemberId: member.id,
            shiftId: allPreferred[i].id,
          },
        },
        update: {
          wantLevel: PreferenceLevel.WANT,
        },
        create: {
          teamMemberId: member.id,
          shiftId: allPreferred[i].id,
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

  const shifts = await seedShiftsFromTemplates(
    event.id,
    templates.map((t) => t.id),
  );
  console.log(`✓ Seeded ${shifts.length} shifts`);

  const registrations = await seedEventRegistrations(event.id);
  console.log(`✓ Seeded ${registrations.length} event registrations`);

  await seedTeamMemberAttributes(event.id, genderDef.id, canDriveDef.id);
  const attributeCount = await prisma.teamMemberAttribute.count();
  console.log(`✓ Seeded ${attributeCount} team member attributes`);

  await seedPreferences(event.id);
  const preferenceCount = await prisma.shiftPreference.count();
  console.log(`✓ Seeded ${preferenceCount} preferences`);

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
