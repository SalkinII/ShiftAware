import {
  AssignmentType,
  EventStatus,
  PreferenceLevel,
  PrismaClient,
  Role,
  ShiftPriority,
  ShiftType,
} from "@prisma/client";

const prisma = new PrismaClient();

const EVENT_ID = "event_starlight_2026";
const EVENT_NAME = "Starlight Meadow Festival 2026";

const teamMembers = [
  {
    alias: "Bunny",
    avatarId: "🐰",
    experienceLevel: "JUNIOR",
    genderRole: "FLINTA",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Otter",
    avatarId: "🦦",
    experienceLevel: "JUNIOR",
    genderRole: "M_NB",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Chipmunk",
    avatarId: "🐿️",
    experienceLevel: "JUNIOR",
    genderRole: "FLINTA",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Hedgehog",
    avatarId: "🦔",
    experienceLevel: "JUNIOR",
    genderRole: "M_NB",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Squirrel",
    avatarId: "🐿️",
    experienceLevel: "JUNIOR",
    genderRole: "FLINTA",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Robin",
    avatarId: "🐦",
    experienceLevel: "JUNIOR",
    genderRole: "M_NB",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Finch",
    avatarId: "🐦",
    experienceLevel: "JUNIOR",
    genderRole: "FLINTA",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Duckling",
    avatarId: "🦆",
    experienceLevel: "JUNIOR",
    genderRole: "M_NB",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Fawn",
    avatarId: "🦌",
    experienceLevel: "JUNIOR",
    genderRole: "FLINTA",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Kitten",
    avatarId: "🐱",
    experienceLevel: "JUNIOR",
    genderRole: "M_NB",
    capabilities: [Role.TEAM_MEMBER],
  },

  {
    alias: "Fox",
    avatarId: "🦊",
    experienceLevel: "INTERMEDIATE",
    genderRole: "FLINTA",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Badger",
    avatarId: "🦡",
    experienceLevel: "INTERMEDIATE",
    genderRole: "M_NB",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Raccoon",
    avatarId: "🦝",
    experienceLevel: "INTERMEDIATE",
    genderRole: "FLINTA",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Panda",
    avatarId: "🐼",
    experienceLevel: "INTERMEDIATE",
    genderRole: "M_NB",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Koala",
    avatarId: "🐨",
    experienceLevel: "INTERMEDIATE",
    genderRole: "FLINTA",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Owl",
    avatarId: "🦉",
    experienceLevel: "INTERMEDIATE",
    genderRole: "M_NB",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Peacock",
    avatarId: "🦚",
    experienceLevel: "INTERMEDIATE",
    genderRole: "FLINTA",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Swan",
    avatarId: "🦢",
    experienceLevel: "INTERMEDIATE",
    genderRole: "M_NB",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Deer",
    avatarId: "🦌",
    experienceLevel: "INTERMEDIATE",
    genderRole: "FLINTA",
    capabilities: [Role.TEAM_MEMBER],
  },
  {
    alias: "Lynx",
    avatarId: "🐆",
    experienceLevel: "INTERMEDIATE",
    genderRole: "M_NB",
    capabilities: [Role.TEAM_MEMBER],
  },

  {
    alias: "Wolf",
    avatarId: "🐺",
    experienceLevel: "SENIOR",
    genderRole: "M_NB",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER],
  },
  {
    alias: "Bear",
    avatarId: "🐻",
    experienceLevel: "SENIOR",
    genderRole: "FLINTA",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD],
  },
  {
    alias: "Eagle",
    avatarId: "🦅",
    experienceLevel: "SENIOR",
    genderRole: "M_NB",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER],
  },
  {
    alias: "Hawk",
    avatarId: "🦅",
    experienceLevel: "SENIOR",
    genderRole: "FLINTA",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD],
  },
  {
    alias: "Lion",
    avatarId: "🦁",
    experienceLevel: "SENIOR",
    genderRole: "M_NB",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER],
  },
  {
    alias: "Tiger",
    avatarId: "🐯",
    experienceLevel: "SENIOR",
    genderRole: "FLINTA",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER],
  },
  {
    alias: "Falcon",
    avatarId: "🦅",
    experienceLevel: "SENIOR",
    genderRole: "M_NB",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD],
  },
  {
    alias: "Leopard",
    avatarId: "🐆",
    experienceLevel: "SENIOR",
    genderRole: "FLINTA",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD],
  },
  {
    alias: "Panther",
    avatarId: "🐆",
    experienceLevel: "SENIOR",
    genderRole: "M_NB",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER],
  },
  {
    alias: "Jaguar",
    avatarId: "🐆",
    experienceLevel: "SENIOR",
    genderRole: "FLINTA",
    capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER],
  },
];

// Generate comprehensive shift data for the full event period
function generateShifts() {
  const shifts: Array<{
    id: string;
    type: ShiftType;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    priority: ShiftPriority;
    desirabilityScore: number;
    capacity: number;
    requiredRoles: Array<{ role: Role; count: number }>;
  }> = [];

  // Core event dates: June 26-29, 2026
  const coreDates = [
    { date: "2026-06-26", day: "Thursday" },
    { date: "2026-06-27", day: "Friday" },
    { date: "2026-06-28", day: "Saturday" },
    { date: "2026-06-29", day: "Sunday" },
  ];

  // Buffer dates: June 11-25 and June 30 - July 8
  const bufferDates: string[] = [];
  for (let i = 11; i <= 25; i++) {
    bufferDates.push(`2026-06-${i.toString().padStart(2, "0")}`);
  }
  for (let i = 30; i <= 30; i++) {
    bufferDates.push(`2026-06-${i.toString().padStart(2, "0")}`);
  }
  for (let i = 1; i <= 8; i++) {
    bufferDates.push(`2026-07-${i.toString().padStart(2, "0")}`);
  }

  let shiftCounter = 1;

  // Core event shifts - more intensive coverage
  coreDates.forEach(({ date }) => {
    // Morning stationary (6am-12pm)
    shifts.push({
      id: `shift_core_${date}_stationary_morning`,
      type: ShiftType.STATIONARY,
      startTime: `${date}T06:00:00.000Z`,
      endTime: `${date}T12:00:00.000Z`,
      durationMinutes: 360,
      priority: ShiftPriority.CORE,
      desirabilityScore: 3,
      capacity: 3,
      requiredRoles: [
        { role: Role.SHIFT_LEAD, count: 1 },
        { role: Role.TEAM_MEMBER, count: 2 },
      ],
    });

    // Afternoon Mobile Team (12pm-6pm)
    shifts.push({
      id: `shift_core_${date}_mobile1_afternoon`,
      type: ShiftType.MOBILE_TEAM,
      startTime: `${date}T12:00:00.000Z`,
      endTime: `${date}T18:00:00.000Z`,
      durationMinutes: 360,
      priority: ShiftPriority.CORE,
      desirabilityScore: 4,
      capacity: 2,
      requiredRoles: [{ role: Role.TEAM_MEMBER, count: 2 }],
    });

    // Night shift (12am-6am next day)
    const nightStart = new Date(`${date}T00:00:00.000Z`);
    const nightEnd = new Date(nightStart);
    nightEnd.setHours(6, 0, 0, 0);
    const nextDateStr = nightEnd.toISOString().split("T")[0];
    shifts.push({
      id: `shift_core_${date}_night`,
      type: ShiftType.MOBILE_TEAM,
      startTime: `${date}T00:00:00.000Z`,
      endTime: `${nextDateStr}T06:00:00.000Z`,
      durationMinutes: 360,
      priority: ShiftPriority.CORE,
      desirabilityScore: 1,
      capacity: 2,
      requiredRoles: [{ role: Role.TEAM_MEMBER, count: 2 }],
    });
  });

  // SUPER shifts for core days
  coreDates.forEach(({ date }) => {
    shifts.push({
      id: `shift_core_${date}_SUPER`,
      type: ShiftType.SUPER,
      startTime: `${date}T08:00:00.000Z`,
      endTime: `${date}T20:00:00.000Z`,
      durationMinutes: 720,
      priority: ShiftPriority.CORE,
      desirabilityScore: 3,
      capacity: 1,
      requiredRoles: [{ role: Role.SUPER, count: 1 }],
    });
  });

  // Buffer shifts - lighter coverage
  bufferDates.forEach((date, index) => {
    // Every other day for buffer period
    if (index % 2 === 0) {
      // Morning shift
      shifts.push({
        id: `shift_buffer_${date}_morning`,
        type: ShiftType.STATIONARY,
        startTime: `${date}T08:00:00.000Z`,
        endTime: `${date}T14:00:00.000Z`,
        durationMinutes: 360,
        priority: ShiftPriority.BUFFER,
        desirabilityScore: 2,
        capacity: 2,
        requiredRoles: [{ role: Role.TEAM_MEMBER, count: 2 }],
      });

      // Evening shift (6pm-12am, ends next day)
      const eveningStart = new Date(`${date}T18:00:00.000Z`);
      const eveningEnd = new Date(eveningStart);
      eveningEnd.setDate(eveningEnd.getDate() + 1);
      eveningEnd.setHours(0, 0, 0, 0);
      const eveningEndDateStr = eveningEnd.toISOString().split("T")[0];
      shifts.push({
        id: `shift_buffer_${date}_evening`,
        type: ShiftType.MOBILE_TEAM,
        startTime: `${date}T18:00:00.000Z`,
        endTime: `${eveningEndDateStr}T00:00:00.000Z`,
        durationMinutes: 360,
        priority: ShiftPriority.BUFFER,
        desirabilityScore: 2,
        capacity: 2,
        requiredRoles: [{ role: Role.TEAM_MEMBER, count: 2 }],
      });
    }
  });

  return shifts;
}

const shifts = generateShifts();

async function seedTeam() {
  for (const member of teamMembers) {
    await prisma.teamMember.upsert({
      where: { alias: member.alias },
      update: {
        avatarId: member.avatarId,
        experienceLevel: member.experienceLevel as any,
        genderRole: member.genderRole,
        capabilities: member.capabilities,
        isActive: true,
      },
      create: {
        alias: member.alias,
        avatarId: member.avatarId,
        experienceLevel: member.experienceLevel as any,
        genderRole: member.genderRole,
        capabilities: member.capabilities,
      },
    });
  }
}

async function seedEvent() {
  await prisma.event.upsert({
    where: { id: EVENT_ID },
    update: {
      name: EVENT_NAME,
      startDate: new Date("2026-06-11T00:00:00.000Z"),
      endDate: new Date("2026-07-08T23:59:59.000Z"),
      status: EventStatus.PLANNING,
    },
    create: {
      id: EVENT_ID,
      name: EVENT_NAME,
      startDate: new Date("2026-06-11T00:00:00.000Z"),
      endDate: new Date("2026-07-08T23:59:59.000Z"),
      status: EventStatus.PLANNING,
    },
  });

  await prisma.eventConfig.upsert({
    where: { eventId: EVENT_ID },
    update: {
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
    },
    create: {
      eventId: EVENT_ID,
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
    },
  });
}

async function seedShifts() {
  for (const shift of shifts) {
    const record = await prisma.shift.upsert({
      where: { id: shift.id },
      update: {
        eventId: EVENT_ID,
        type: shift.type,
        startTime: new Date(shift.startTime),
        endTime: new Date(shift.endTime),
        durationMinutes: shift.durationMinutes,
        priority: shift.priority,
        desirabilityScore: shift.desirabilityScore,
        capacity: shift.capacity,
        isTemplate: false,
      },
      create: {
        id: shift.id,
        eventId: EVENT_ID,
        type: shift.type,
        startTime: new Date(shift.startTime),
        endTime: new Date(shift.endTime),
        durationMinutes: shift.durationMinutes,
        priority: shift.priority,
        desirabilityScore: shift.desirabilityScore,
        capacity: shift.capacity,
        isTemplate: false,
      },
    });

    for (const role of shift.requiredRoles) {
      await prisma.shiftRole.upsert({
        where: {
          shiftId_role: {
            shiftId: record.id,
            role: role.role,
          },
        },
        update: { count: role.count },
        create: {
          shiftId: record.id,
          role: role.role,
          count: role.count,
        },
      });
    }
  }
}

async function seedPreferences() {
  // Get all members and shifts
  const members = await prisma.teamMember.findMany();
  const allShifts = await prisma.shift.findMany({
    where: { eventId: EVENT_ID },
    orderBy: { startTime: "asc" },
  });

  // Create preferences for each member
  // Each member prefers 3-5 shifts, prioritizing core shifts
  for (const member of members) {
    const coreShifts = allShifts.filter(
      (s) => s.priority === ShiftPriority.CORE,
    );
    const bufferShifts = allShifts.filter(
      (s) => s.priority === ShiftPriority.BUFFER,
    );

    // Each member prefers 2-3 core shifts and 1-2 buffer shifts
    const preferredCoreShifts = coreShifts
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(Math.random() * 2) + 2); // 2-3 core shifts

    const preferredBufferShifts = bufferShifts
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(Math.random() * 2) + 1); // 1-2 buffer shifts

    const allPreferred = [
      ...preferredCoreShifts,
      ...preferredBufferShifts,
    ].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    // Create preferences with priorities (1 = highest priority)
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

async function resetForSeed() {
  await prisma.assignment.deleteMany();
  await prisma.shiftPreference.deleteMany();
  await prisma.shiftRole.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.eventConfig.deleteMany();
  await prisma.event.deleteMany();
  await prisma.teamMember.deleteMany();
}

async function main() {
  await resetForSeed();
  await seedTeam();
  await seedEvent();
  await seedShifts();
  await seedPreferences();
  await seedSystemConfig();
  console.log(`✓ Seeded ${teamMembers.length} team members`);
  console.log(`✓ Seeded ${shifts.length} shifts`);
  const preferenceCount = await prisma.shiftPreference.count();
  console.log(`✓ Seeded ${preferenceCount} preferences`);
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
