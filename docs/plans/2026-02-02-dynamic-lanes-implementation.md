# Dynamic Lanes & Data Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded lane configuration with dynamic lanes derived from ShiftTemplate data, align enums, and reset database.

**Architecture:** Lanes are derived from ShiftTemplate records at runtime. Each template's name becomes a lane label, its color becomes the lane color, and laneOrder controls vertical position. Shifts link to templates via templateId for lane mapping.

**Tech Stack:** Next.js 15, Prisma, PostgreSQL, TypeScript, Zod

**Reference:** `docs/plans/2026-02-02-dynamic-lanes-design.md`

---

## Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add laneOrder to ShiftTemplate**

Find the ShiftTemplate model (around line 310) and add `laneOrder`:

```prisma
model ShiftTemplate {
  id                String        @id @default(cuid())
  name              String
  type              ShiftType
  durationMinutes   Int
  startTime         String // "08:00" - time only, no date
  priority          ShiftPriority @default(CORE)
  desirabilityScore Int           @default(3)
  capacity          Int           @default(2)
  color             String? // For UI display
  laneOrder         Int           @default(0) // NEW: vertical position in calendar

  // Optional event for event-specific templates
  eventId String?
  event   Event?  @relation("EventSpecificTemplates", fields: [eventId], references: [id])

  requiredRoles    ShiftTemplateRole[]
  scheduledShifts  ScheduledShift[]
  eventAssignments EventTemplate[]
  shifts           Shift[]             @relation("ShiftFromTemplate") // NEW

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([eventId])
}
```

**Step 2: Add templateId to Shift**

Find the Shift model (around line 188) and add `templateId`:

```prisma
model Shift {
  id      String @id @default(cuid())
  eventId String
  event   Event  @relation(fields: [eventId], references: [id])

  // NEW: Direct link to template for lane mapping
  templateId String?
  template   ShiftTemplate? @relation("ShiftFromTemplate", fields: [templateId], references: [id])

  type              ShiftType
  startTime         DateTime
  endTime           DateTime
  durationMinutes   Int
  priority          ShiftPriority @default(CORE)
  desirabilityScore Int           @default(3)
  isTemplate        Boolean       @default(false)

  requiredRoles ShiftRole[]
  capacity      Int         @default(2)

  preferences    ShiftPreference[]
  assignments    Assignment[]
  swapRequestsTo SwapRequest[]     @relation("SwapTo")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([eventId, startTime])
  @@index([type, priority])
  @@index([templateId]) // NEW
}
```

**Step 3: Remove allowedLanes from ShiftTemplate**

Delete this line from ShiftTemplate:
```prisma
allowedLanes      ShiftType[]   @default([]) // DELETE THIS LINE
```

**Step 4: Verify schema syntax**

Run: `npx prisma validate`

Expected: "The Prisma schema is valid."

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "schema: add laneOrder to ShiftTemplate, templateId to Shift"
```

---

## Task 2: Create Prisma Migration

**Files:**
- Generate: `prisma/migrations/YYYYMMDD_dynamic_lanes/migration.sql`

**Step 1: Generate migration**

Run: `npx prisma migrate dev --name dynamic_lanes`

Expected: Migration created successfully.

If prompted about data loss for `allowedLanes`, accept (we're resetting anyway).

**Step 2: Verify migration applied**

Run: `npx prisma migrate status`

Expected: All migrations applied.

**Step 3: Commit migration**

```bash
git add prisma/migrations/
git commit -m "migration: add dynamic lanes fields"
```

---

## Task 3: Update Zod Validations

**Files:**
- Modify: `lib/validations/template.ts`
- Modify: `lib/validations/shift.ts`

**Step 1: Read current template validation**

Check `lib/validations/template.ts` for current schema.

**Step 2: Add laneOrder to template schema**

In `lib/validations/template.ts`, add to the schema:

```typescript
export const shiftTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.nativeEnum(ShiftType),
  durationMinutes: z.number().int().min(15).max(1440),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
  priority: z.nativeEnum(ShiftPriority).optional(),
  desirabilityScore: z.number().int().min(1).max(5).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  laneOrder: z.number().int().min(0).max(100).optional(), // NEW
  eventId: z.string().cuid().optional().nullable(),
  requiredRoles: z.array(z.object({
    role: z.nativeEnum(Role),
    count: z.number().int().min(1).max(20),
  })).optional(),
});
```

**Step 3: Add templateId to shift schema**

In `lib/validations/shift.ts`, add to the schema:

```typescript
export const shiftSchema = z.object({
  eventId: z.string().cuid(),
  templateId: z.string().cuid().optional().nullable(), // NEW
  type: z.nativeEnum(ShiftType),
  startTime: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid datetime"),
  endTime: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid datetime"),
  durationMinutes: z.number().int().min(15).max(1440),
  priority: z.nativeEnum(ShiftPriority).optional(),
  desirabilityScore: z.number().int().min(1).max(5).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  isTemplate: z.boolean().optional(),
  requiredRoles: z.array(z.object({
    role: z.nativeEnum(Role),
    count: z.number().int().min(1).max(20),
  })).optional(),
});
```

**Step 4: Commit**

```bash
git add lib/validations/template.ts lib/validations/shift.ts
git commit -m "validation: add laneOrder and templateId fields"
```

---

## Task 4: Rewrite Lane Types

**Files:**
- Modify: `lib/types/lane.ts`

**Step 1: Replace entire file**

```typescript
// lib/types/lane.ts
// Dynamic lanes derived from ShiftTemplate data

export interface Lane {
  id: string;           // template ID
  name: string;         // template name (displayed as lane label)
  type: string;         // ShiftType for filtering
  color: string;        // hex color for lane
  order: number;        // laneOrder for vertical position
}

export interface ShiftTemplateForLane {
  id: string;
  name: string;
  type: string;
  color?: string | null;
  laneOrder?: number | null;
}

/**
 * Derive calendar lanes from ShiftTemplate records.
 * Each template becomes one lane, ordered by laneOrder.
 */
export function deriveLanesFromTemplates(templates: ShiftTemplateForLane[]): Lane[] {
  return templates
    .map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      color: t.color || '#6b7280',
      order: t.laneOrder ?? 0,
    }))
    .sort((a, b) => a.order - b.order);
}

/**
 * Get lane color by template ID.
 */
export function getLaneColor(lanes: Lane[], templateId: string | null | undefined): string {
  if (!templateId) return '#6b7280';
  return lanes.find((l) => l.id === templateId)?.color ?? '#6b7280';
}

/**
 * Get lane label by template ID.
 */
export function getLaneLabel(lanes: Lane[], templateId: string | null | undefined): string {
  if (!templateId) return 'Unassigned';
  return lanes.find((l) => l.id === templateId)?.name ?? 'Unknown';
}

/**
 * Find lane for a shift based on its templateId.
 * Falls back to first lane matching shift type if no templateId.
 */
export function findLaneForShift(
  lanes: Lane[],
  shift: { templateId?: string | null; type: string }
): Lane | undefined {
  if (shift.templateId) {
    return lanes.find((l) => l.id === shift.templateId);
  }
  // Fallback: match by type
  return lanes.find((l) => l.type === shift.type);
}
```

**Step 2: Commit**

```bash
git add lib/types/lane.ts
git commit -m "refactor: dynamic lanes derived from templates"
```

---

## Task 5: Update Shifts API

**Files:**
- Modify: `app/api/shifts/route.ts`

**Step 1: Add template to GET include**

In `app/api/shifts/route.ts`, update the GET handler's include:

```typescript
const shifts = await prisma.shift.findMany({
  where: eventId ? { eventId } : undefined,
  include: {
    event: true,
    template: true, // NEW: include template for lane mapping
    requiredRoles: true,
    assignments: {
      select: {
        id: true,
        role: true,
        assignmentType: true,
        algorithmScore: true,
        notes: true,
        teamMember: {
          select: {
            id: true,
            alias: true,
            avatarId: true,
          },
        },
      },
    },
    _count: {
      select: {
        preferences: true,
        assignments: true,
      },
    },
  },
  orderBy: { startTime: "asc" },
});
```

**Step 2: Add templateId to POST create**

In the POST handler, the `shiftData` already spreads validated fields. Since we added `templateId` to the schema, it will be included automatically. Verify the create includes it:

```typescript
const shift = await prisma.shift.create({
  data: {
    ...shiftData,
    templateId: validated.templateId || null, // Explicit for clarity
    startTime: new Date(validated.startTime),
    endTime: new Date(validated.endTime),
    requiredRoles: {
      create: requiredRoles,
    },
  },
  include: {
    requiredRoles: true,
    event: true,
    template: true, // NEW
  },
});
```

**Step 3: Commit**

```bash
git add app/api/shifts/route.ts
git commit -m "api: include template in shifts response, accept templateId on create"
```

---

## Task 6: Update Templates API Ordering

**Files:**
- Modify: `app/api/shifts/templates/route.ts`

**Step 1: Change orderBy to laneOrder**

In GET handler, change:

```typescript
// OLD:
orderBy: {
  createdAt: "desc",
},

// NEW:
orderBy: [
  { laneOrder: "asc" },
  { createdAt: "desc" },
],
```

**Step 2: Commit**

```bash
git add app/api/shifts/templates/route.ts
git commit -m "api: order templates by laneOrder"
```

---

## Task 7: Update Seed File

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: Replace entire seed file**

```typescript
import {
  AssignmentType,
  EventStatus,
  ExperienceLevel,
  PreferenceLevel,
  PrismaClient,
  RegistrationStatus,
  Role,
  ShiftPriority,
  ShiftType,
} from "@prisma/client";

const prisma = new PrismaClient();

// === CONSTANTS ===
const EVENT_ID = "event_starlight_2026";
const EVENT_NAME = "Starlight Meadow Festival 2026";

// === TEMPLATES (Define Lanes) ===
const TEMPLATES = [
  {
    id: "tpl_mobile_north",
    name: "Mobile North",
    type: ShiftType.MOBILE_TEAM,
    color: "#0ea5e9",
    laneOrder: 1,
    durationMinutes: 360,
    startTime: "08:00",
    capacity: 2,
    requiredRoles: [{ role: Role.TEAM_MEMBER, count: 2 }],
  },
  {
    id: "tpl_mobile_south",
    name: "Mobile South",
    type: ShiftType.MOBILE_TEAM,
    color: "#8b5cf6",
    laneOrder: 2,
    durationMinutes: 360,
    startTime: "08:00",
    capacity: 2,
    requiredRoles: [{ role: Role.TEAM_MEMBER, count: 2 }],
  },
  {
    id: "tpl_info_tent",
    name: "Info Tent",
    type: ShiftType.STATIONARY,
    color: "#22c55e",
    laneOrder: 3,
    durationMinutes: 360,
    startTime: "10:00",
    capacity: 3,
    requiredRoles: [
      { role: Role.SHIFT_LEAD, count: 1 },
      { role: Role.TEAM_MEMBER, count: 2 },
    ],
  },
  {
    id: "tpl_coordination",
    name: "Coordination",
    type: ShiftType.SUPER,
    color: "#f59e0b",
    laneOrder: 4,
    durationMinutes: 720,
    startTime: "08:00",
    capacity: 1,
    requiredRoles: [{ role: Role.SUPER, count: 1 }],
  },
];

// === TEAM MEMBERS ===
const TEAM_MEMBERS = [
  // Juniors (10)
  { alias: "Bunny", avatarId: "🐰", experienceLevel: ExperienceLevel.JUNIOR, genderRole: "FLINTA", capabilities: [Role.TEAM_MEMBER] },
  { alias: "Otter", avatarId: "🦦", experienceLevel: ExperienceLevel.JUNIOR, genderRole: "M_NB", capabilities: [Role.TEAM_MEMBER] },
  { alias: "Chipmunk", avatarId: "🐿️", experienceLevel: ExperienceLevel.JUNIOR, genderRole: "FLINTA", capabilities: [Role.TEAM_MEMBER] },
  { alias: "Hedgehog", avatarId: "🦔", experienceLevel: ExperienceLevel.JUNIOR, genderRole: "M_NB", capabilities: [Role.TEAM_MEMBER] },
  { alias: "Squirrel", avatarId: "🐿️", experienceLevel: ExperienceLevel.JUNIOR, genderRole: "FLINTA", capabilities: [Role.TEAM_MEMBER] },
  { alias: "Robin", avatarId: "🐦", experienceLevel: ExperienceLevel.JUNIOR, genderRole: "M_NB", capabilities: [Role.TEAM_MEMBER] },
  { alias: "Finch", avatarId: "🐦", experienceLevel: ExperienceLevel.JUNIOR, genderRole: "FLINTA", capabilities: [Role.TEAM_MEMBER] },
  { alias: "Duckling", avatarId: "🦆", experienceLevel: ExperienceLevel.JUNIOR, genderRole: "M_NB", capabilities: [Role.TEAM_MEMBER] },
  { alias: "Fawn", avatarId: "🦌", experienceLevel: ExperienceLevel.JUNIOR, genderRole: "FLINTA", capabilities: [Role.TEAM_MEMBER] },
  { alias: "Kitten", avatarId: "🐱", experienceLevel: ExperienceLevel.JUNIOR, genderRole: "M_NB", capabilities: [Role.TEAM_MEMBER] },
  
  // Intermediates (10)
  { alias: "Fox", avatarId: "🦊", experienceLevel: ExperienceLevel.INTERMEDIATE, genderRole: "FLINTA", capabilities: [Role.TEAM_MEMBER] },
  { alias: "Badger", avatarId: "🦡", experienceLevel: ExperienceLevel.INTERMEDIATE, genderRole: "M_NB", capabilities: [Role.TEAM_MEMBER] },
  { alias: "Raccoon", avatarId: "🦝", experienceLevel: ExperienceLevel.INTERMEDIATE, genderRole: "FLINTA", capabilities: [Role.TEAM_MEMBER] },
  { alias: "Panda", avatarId: "🐼", experienceLevel: ExperienceLevel.INTERMEDIATE, genderRole: "M_NB", capabilities: [Role.TEAM_MEMBER] },
  { alias: "Koala", avatarId: "🐨", experienceLevel: ExperienceLevel.INTERMEDIATE, genderRole: "FLINTA", capabilities: [Role.TEAM_MEMBER] },
  { alias: "Owl", avatarId: "🦉", experienceLevel: ExperienceLevel.INTERMEDIATE, genderRole: "M_NB", capabilities: [Role.TEAM_MEMBER] },
  { alias: "Peacock", avatarId: "🦚", experienceLevel: ExperienceLevel.INTERMEDIATE, genderRole: "FLINTA", capabilities: [Role.TEAM_MEMBER] },
  { alias: "Swan", avatarId: "🦢", experienceLevel: ExperienceLevel.INTERMEDIATE, genderRole: "M_NB", capabilities: [Role.TEAM_MEMBER] },
  { alias: "Deer", avatarId: "🦌", experienceLevel: ExperienceLevel.INTERMEDIATE, genderRole: "FLINTA", capabilities: [Role.TEAM_MEMBER] },
  { alias: "Lynx", avatarId: "🐆", experienceLevel: ExperienceLevel.INTERMEDIATE, genderRole: "M_NB", capabilities: [Role.TEAM_MEMBER] },
  
  // Seniors with leadership (10)
  { alias: "Wolf", avatarId: "🐺", experienceLevel: ExperienceLevel.SENIOR, genderRole: "M_NB", capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER] },
  { alias: "Bear", avatarId: "🐻", experienceLevel: ExperienceLevel.SENIOR, genderRole: "FLINTA", capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD] },
  { alias: "Eagle", avatarId: "🦅", experienceLevel: ExperienceLevel.SENIOR, genderRole: "M_NB", capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER] },
  { alias: "Hawk", avatarId: "🦅", experienceLevel: ExperienceLevel.SENIOR, genderRole: "FLINTA", capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD] },
  { alias: "Lion", avatarId: "🦁", experienceLevel: ExperienceLevel.SENIOR, genderRole: "M_NB", capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER] },
  { alias: "Tiger", avatarId: "🐯", experienceLevel: ExperienceLevel.SENIOR, genderRole: "FLINTA", capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER] },
  { alias: "Falcon", avatarId: "🦅", experienceLevel: ExperienceLevel.SENIOR, genderRole: "M_NB", capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD] },
  { alias: "Leopard", avatarId: "🐆", experienceLevel: ExperienceLevel.SENIOR, genderRole: "FLINTA", capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD] },
  { alias: "Panther", avatarId: "🐆", experienceLevel: ExperienceLevel.SENIOR, genderRole: "M_NB", capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER] },
  { alias: "Jaguar", avatarId: "🐆", experienceLevel: ExperienceLevel.SENIOR, genderRole: "FLINTA", capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER] },
];

// === SEED FUNCTIONS ===

async function seedTeamMembers() {
  for (const member of TEAM_MEMBERS) {
    await prisma.teamMember.upsert({
      where: { alias: member.alias },
      update: { ...member },
      create: { ...member },
    });
  }
  console.log(`✓ Seeded ${TEAM_MEMBERS.length} team members`);
}

async function seedEvent() {
  // Create event
  await prisma.event.upsert({
    where: { id: EVENT_ID },
    update: {
      name: EVENT_NAME,
      startDate: new Date("2026-06-26T00:00:00.000Z"),
      endDate: new Date("2026-06-29T23:59:59.000Z"),
      status: EventStatus.PLANNING,
    },
    create: {
      id: EVENT_ID,
      name: EVENT_NAME,
      startDate: new Date("2026-06-26T00:00:00.000Z"),
      endDate: new Date("2026-06-29T23:59:59.000Z"),
      status: EventStatus.PLANNING,
    },
  });

  // Create event config
  await prisma.eventConfig.upsert({
    where: { eventId: EVENT_ID },
    update: {
      minShiftsPerPerson: 2,
      algorithmWeights: {
        preferenceMatch: 0.35,
        experienceBalance: 0.25,
        workloadFairness: 0.25,
        genderBalance: 0.15,
      },
      balanceThresholds: {
        minGenderBalance: 0.3,
        maxConsecutiveShifts: 3,
      },
      autoAssignUnfilled: true,
      bufferDaysBefore: 1,
      bufferDaysAfter: 1,
    },
    create: {
      eventId: EVENT_ID,
      minShiftsPerPerson: 2,
      algorithmWeights: {
        preferenceMatch: 0.35,
        experienceBalance: 0.25,
        workloadFairness: 0.25,
        genderBalance: 0.15,
      },
      balanceThresholds: {
        minGenderBalance: 0.3,
        maxConsecutiveShifts: 3,
      },
      autoAssignUnfilled: true,
      bufferDaysBefore: 1,
      bufferDaysAfter: 1,
    },
  });

  console.log(`✓ Seeded event: ${EVENT_NAME}`);
}

async function seedTemplates() {
  for (const template of TEMPLATES) {
    const { requiredRoles, ...templateData } = template;
    
    // Delete existing roles first
    await prisma.shiftTemplateRole.deleteMany({
      where: { templateId: template.id },
    });

    await prisma.shiftTemplate.upsert({
      where: { id: template.id },
      update: {
        ...templateData,
        eventId: null, // Global templates
      },
      create: {
        ...templateData,
        eventId: null,
      },
    });

    // Create roles
    for (const role of requiredRoles) {
      await prisma.shiftTemplateRole.create({
        data: {
          templateId: template.id,
          role: role.role,
          count: role.count,
        },
      });
    }

    // Assign template to event
    await prisma.eventTemplate.upsert({
      where: {
        eventId_templateId: {
          eventId: EVENT_ID,
          templateId: template.id,
        },
      },
      update: {},
      create: {
        eventId: EVENT_ID,
        templateId: template.id,
      },
    });
  }
  console.log(`✓ Seeded ${TEMPLATES.length} templates (assigned to event)`);
}

async function seedShifts() {
  const coreDates = ["2026-06-26", "2026-06-27", "2026-06-28", "2026-06-29"];
  let shiftCount = 0;

  for (const date of coreDates) {
    for (const template of TEMPLATES) {
      const [hours, minutes] = template.startTime.split(":").map(Number);
      const startTime = new Date(`${date}T${template.startTime}:00.000Z`);
      const endTime = new Date(startTime.getTime() + template.durationMinutes * 60000);

      const shiftId = `shift_${date}_${template.id}`;

      // Delete existing roles
      await prisma.shiftRole.deleteMany({ where: { shiftId } });

      const shift = await prisma.shift.upsert({
        where: { id: shiftId },
        update: {
          eventId: EVENT_ID,
          templateId: template.id,
          type: template.type,
          startTime,
          endTime,
          durationMinutes: template.durationMinutes,
          priority: ShiftPriority.CORE,
          desirabilityScore: 3,
          capacity: template.capacity,
        },
        create: {
          id: shiftId,
          eventId: EVENT_ID,
          templateId: template.id,
          type: template.type,
          startTime,
          endTime,
          durationMinutes: template.durationMinutes,
          priority: ShiftPriority.CORE,
          desirabilityScore: 3,
          capacity: template.capacity,
        },
      });

      // Create roles
      for (const role of template.requiredRoles) {
        await prisma.shiftRole.create({
          data: {
            shiftId: shift.id,
            role: role.role,
            count: role.count,
          },
        });
      }

      shiftCount++;
    }
  }
  console.log(`✓ Seeded ${shiftCount} shifts (4 days × ${TEMPLATES.length} templates)`);
}

async function seedRegistrations() {
  const members = await prisma.teamMember.findMany();
  
  for (const member of members) {
    await prisma.eventRegistration.upsert({
      where: {
        memberId_eventId: {
          memberId: member.id,
          eventId: EVENT_ID,
        },
      },
      update: { status: RegistrationStatus.CONFIRMED },
      create: {
        memberId: member.id,
        eventId: EVENT_ID,
        status: RegistrationStatus.CONFIRMED,
      },
    });
  }
  console.log(`✓ Registered ${members.length} members for event`);
}

async function seedPreferences() {
  const members = await prisma.teamMember.findMany();
  const shifts = await prisma.shift.findMany({ where: { eventId: EVENT_ID } });
  
  let prefCount = 0;
  
  for (const member of members) {
    // Each member wants 2-4 random shifts
    const shuffled = shifts.sort(() => Math.random() - 0.5);
    const wanted = shuffled.slice(0, 2 + Math.floor(Math.random() * 3));
    
    for (const shift of wanted) {
      await prisma.shiftPreference.upsert({
        where: {
          teamMemberId_shiftId: {
            teamMemberId: member.id,
            shiftId: shift.id,
          },
        },
        update: { wantLevel: PreferenceLevel.WANT },
        create: {
          teamMemberId: member.id,
          shiftId: shift.id,
          wantLevel: PreferenceLevel.WANT,
        },
      });
      prefCount++;
    }
  }
  console.log(`✓ Seeded ${prefCount} preferences`);
}

async function seedSystemConfig() {
  await prisma.systemConfig.upsert({
    where: { key: "session_timeout_minutes" },
    update: { value: 60 },
    create: { key: "session_timeout_minutes", value: 60 },
  });
  console.log(`✓ Seeded system config`);
}

async function resetDatabase() {
  console.log("Resetting database...");
  
  // Delete in correct order (respecting foreign keys)
  await prisma.assignment.deleteMany();
  await prisma.shiftPreference.deleteMany();
  await prisma.swapRequest.deleteMany();
  await prisma.shiftRole.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.scheduledShift.deleteMany();
  await prisma.eventTemplate.deleteMany();
  await prisma.shiftTemplateRole.deleteMany();
  await prisma.shiftTemplate.deleteMany();
  await prisma.teamMemberAttribute.deleteMany();
  await prisma.eventAttributeDefinition.deleteMany();
  await prisma.eventRegistration.deleteMany();
  await prisma.eventConfig.deleteMany();
  await prisma.event.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.systemConfig.deleteMany();
  
  console.log("✓ Database reset complete");
}

async function main() {
  await resetDatabase();
  await seedTeamMembers();
  await seedEvent();
  await seedTemplates();
  await seedShifts();
  await seedRegistrations();
  await seedPreferences();
  await seedSystemConfig();
}

main()
  .then(async () => {
    console.log("\n✓ Seed completed successfully");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed error:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
```

**Step 2: Commit**

```bash
git add prisma/seed.ts
git commit -m "seed: dynamic lanes with valid enums"
```

---

## Task 8: Fix Lane Tests

**Files:**
- Modify: `tests/lane-validation.test.ts`
- Modify: `tests/lane.test.ts`

**Step 1: Update lane-validation.test.ts**

Replace with tests that use valid ShiftType values and new lane functions:

```typescript
import { describe, it, expect } from 'vitest';
import { deriveLanesFromTemplates, findLaneForShift, Lane } from '@/lib/types/lane';
import { ShiftType } from '@prisma/client';

describe('Lane Functions', () => {
  const mockTemplates = [
    { id: 'tpl1', name: 'Mobile North', type: ShiftType.MOBILE_TEAM, color: '#0ea5e9', laneOrder: 1 },
    { id: 'tpl2', name: 'Mobile South', type: ShiftType.MOBILE_TEAM, color: '#8b5cf6', laneOrder: 2 },
    { id: 'tpl3', name: 'Info Tent', type: ShiftType.STATIONARY, color: '#22c55e', laneOrder: 3 },
  ];

  describe('deriveLanesFromTemplates', () => {
    it('derives lanes from templates sorted by laneOrder', () => {
      const lanes = deriveLanesFromTemplates(mockTemplates);
      
      expect(lanes).toHaveLength(3);
      expect(lanes[0].name).toBe('Mobile North');
      expect(lanes[1].name).toBe('Mobile South');
      expect(lanes[2].name).toBe('Info Tent');
    });

    it('uses default color when template has no color', () => {
      const templates = [{ id: 'tpl', name: 'Test', type: ShiftType.BUFFER, color: null, laneOrder: 0 }];
      const lanes = deriveLanesFromTemplates(templates);
      
      expect(lanes[0].color).toBe('#6b7280');
    });

    it('returns empty array for empty templates', () => {
      expect(deriveLanesFromTemplates([])).toEqual([]);
    });
  });

  describe('findLaneForShift', () => {
    const lanes = deriveLanesFromTemplates(mockTemplates);

    it('finds lane by templateId', () => {
      const shift = { templateId: 'tpl2', type: ShiftType.MOBILE_TEAM };
      const lane = findLaneForShift(lanes, shift);
      
      expect(lane?.name).toBe('Mobile South');
    });

    it('falls back to type match when no templateId', () => {
      const shift = { templateId: null, type: ShiftType.STATIONARY };
      const lane = findLaneForShift(lanes, shift);
      
      expect(lane?.name).toBe('Info Tent');
    });

    it('returns undefined when no match', () => {
      const shift = { templateId: null, type: ShiftType.EXTENDED };
      const lane = findLaneForShift(lanes, shift);
      
      expect(lane).toBeUndefined();
    });
  });
});
```

**Step 2: Update lane.test.ts**

Replace with similar structure using valid enums. If the file duplicates tests, consolidate into one file.

**Step 3: Run tests**

Run: `npm test -- tests/lane`

Expected: All tests pass.

**Step 4: Commit**

```bash
git add tests/lane-validation.test.ts tests/lane.test.ts
git commit -m "test: update lane tests for dynamic lanes"
```

---

## Task 9: Update LaneCalendarView

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarView.tsx`

**Step 1: Read current component**

Check the component's props interface and how it uses lanes.

**Step 2: Update props to accept lanes**

Add `lanes` prop and remove any imports of `LANE_CONFIG`:

```typescript
import { Lane, getLaneColor, findLaneForShift } from '@/lib/types/lane';

interface LaneCalendarViewProps {
  shifts: Shift[];
  lanes: Lane[];  // NEW: passed in from parent
  selectedDate?: Date;
  onShiftClick?: (shift: Shift) => void;
  onShiftCreate?: (data: CreateShiftData) => void;
  onShiftUpdate?: (id: string, data: UpdateShiftData) => void;
  editable?: boolean;
}
```

**Step 3: Use lanes prop instead of hardcoded config**

Replace any usage of `LANE_CONFIG` or `LANES_ORDERED` with the `lanes` prop:

```typescript
// OLD:
{LANES_ORDERED.map((lane) => (
  <LaneRow key={lane.type} lane={lane} ... />
))}

// NEW:
{lanes.map((lane) => (
  <LaneRow key={lane.id} lane={lane} ... />
))}
```

**Step 4: Update shift-to-lane mapping**

```typescript
// OLD (if using type):
const lane = LANE_CONFIG[shift.type];

// NEW:
const lane = findLaneForShift(lanes, shift);
```

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarView.tsx
git commit -m "feat: LaneCalendarView accepts dynamic lanes prop"
```

---

## Task 10: Update Admin Schedule Page

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

**Step 1: Fetch templates and derive lanes**

Add template fetching and lane derivation:

```typescript
import { deriveLanesFromTemplates, Lane } from '@/lib/types/lane';

// In component state:
const [lanes, setLanes] = useState<Lane[]>([]);

// In useEffect or data loading:
async function loadTemplates() {
  if (!selectedEventId) return;
  
  const res = await fetch(`/api/events/${selectedEventId}/templates`);
  if (res.ok) {
    const data = await res.json();
    const response = unwrapApiResponse<{ assigned: any[]; eventSpecific: any[] }>(data);
    const allTemplates = [...(response?.assigned || []), ...(response?.eventSpecific || [])];
    setLanes(deriveLanesFromTemplates(allTemplates));
  }
}

// Call when eventId changes:
useEffect(() => {
  loadTemplates();
}, [selectedEventId]);
```

**Step 2: Pass lanes to LaneCalendarView**

```typescript
<LaneCalendarView
  shifts={shifts}
  lanes={lanes}
  selectedDate={selectedDate}
  onShiftClick={handleShiftClick}
  onShiftCreate={handleShiftCreate}
  editable={true}
/>
```

**Step 3: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "feat: derive lanes from templates in schedule page"
```

---

## Task 11: Reset Database and Verify

**Step 1: Stop dev server**

Ensure dev server is stopped.

**Step 2: Reset database**

Run: `npx prisma migrate reset --force`

Expected output:
```
✓ Database reset complete
✓ Seeded 30 team members
✓ Seeded event: Starlight Meadow Festival 2026
✓ Seeded 4 templates (assigned to event)
✓ Seeded 16 shifts (4 days × 4 templates)
✓ Registered 30 members for event
✓ Seeded ~90 preferences
✓ Seeded system config

✓ Seed completed successfully
```

**Step 3: Regenerate Prisma client**

Run: `npx prisma generate`

**Step 4: Start dev server**

Run: `npm run dev`

**Step 5: Verify in browser**

1. Navigate to `/admin/setup`
2. Check Event dropdown - should only show "Starlight Meadow Festival 2026"
3. Navigate to `/admin/shifts/schedule`
4. Calendar should show 4 lanes: Mobile North, Mobile South, Info Tent, Coordination
5. Each lane should have 4 shifts (one per day)

**Step 6: Commit any final fixes**

```bash
git add -A
git commit -m "chore: database reset with dynamic lanes"
```

---

## Task 12: Final Verification

**Step 1: Run all tests**

Run: `npm test`

Expected: All tests pass.

**Step 2: Check for TypeScript errors**

Run: `npx tsc --noEmit`

Expected: No errors.

**Step 3: Verify key flows**

1. Admin can see calendar with dynamic lanes
2. Shifts appear in correct lanes based on template
3. No old events in dropdowns
4. Template palette works (if applicable)

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete dynamic lanes implementation"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | schema.prisma | Add laneOrder, templateId |
| 2 | migrations/ | Generate migration |
| 3 | validations/*.ts | Add new fields to Zod |
| 4 | lib/types/lane.ts | Rewrite for dynamic lanes |
| 5 | api/shifts/route.ts | Include template in response |
| 6 | api/shifts/templates/route.ts | Order by laneOrder |
| 7 | seed.ts | Complete rewrite with valid enums |
| 8 | tests/lane*.ts | Update tests |
| 9 | LaneCalendarView.tsx | Accept lanes prop |
| 10 | schedule/page.tsx | Derive lanes from templates |
| 11 | (commands) | Reset database |
| 12 | (verification) | Final testing |
