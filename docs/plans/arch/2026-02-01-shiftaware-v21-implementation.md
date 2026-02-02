# ShiftAware v2.1 Complete Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement coherent event-scoped data flow, unified lane calendar, and all user features (voting, swap, allocation) as designed in `2026-02-01-shiftaware-v21-complete-design.md`.

**Architecture:** Add junction tables (EventRegistration, EventTemplate, SwapRequest) to enable event-scoped queries. Unify calendar components into single LaneCalendarView with time-based positioning. Wire all STUB/NOT_WIRED UI elements to APIs.

**Tech Stack:** Next.js 15, React 19, Prisma, PostgreSQL, DnD-Kit, Zod, Vitest, Playwright

**Reference:** `docs/plans/2026-02-01-shiftaware-v21-complete-design.md`

---

## Phase 1: Database Schema

### Task 1.1: Add RegistrationStatus and SwapStatus Enums

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add enums to schema**

Add after existing enums (around line 76):

```prisma
enum RegistrationStatus {
  REGISTERED
  CONFIRMED
  DECLINED
}

enum SwapStatus {
  PENDING
  MATCHED
  APPROVED
  DECLINED
  CANCELLED
}

enum PreferenceLevel {
  WANT
  DONT_WANT
}
```

**Step 2: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add RegistrationStatus, SwapStatus, PreferenceLevel enums"
```

---

### Task 1.2: Add EventRegistration Table

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add EventRegistration model**

Add after the `Event` model:

```prisma
model EventRegistration {
  id           String             @id @default(cuid())
  memberId     String
  member       TeamMember         @relation(fields: [memberId], references: [id], onDelete: Cascade)
  eventId      String
  event        Event              @relation(fields: [eventId], references: [id], onDelete: Cascade)
  status       RegistrationStatus @default(REGISTERED)
  registeredAt DateTime           @default(now())

  @@unique([memberId, eventId])
  @@index([eventId])
  @@index([memberId])
}
```

**Step 2: Add relation to Event model**

Find the `Event` model and add to its relations:

```prisma
model Event {
  // ... existing fields ...
  registrations        EventRegistration[]
  // ... rest of relations ...
}
```

**Step 3: Add relation to TeamMember model**

Find the `TeamMember` model and add:

```prisma
model TeamMember {
  // ... existing fields ...
  eventRegistrations EventRegistration[]
  // ... rest of relations ...
}
```

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add EventRegistration junction table"
```

---

### Task 1.3: Add EventTemplate Table

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add EventTemplate model**

Add after `EventRegistration`:

```prisma
model EventTemplate {
  id         String        @id @default(cuid())
  eventId    String
  event      Event         @relation(fields: [eventId], references: [id], onDelete: Cascade)
  templateId String
  template   ShiftTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([eventId, templateId])
  @@index([eventId])
  @@index([templateId])
}
```

**Step 2: Add relation to Event model**

```prisma
model Event {
  // ... existing fields ...
  templateAssignments  EventTemplate[]
  // ... rest ...
}
```

**Step 3: Add relation to ShiftTemplate model**

```prisma
model ShiftTemplate {
  // ... existing fields ...
  eventAssignments EventTemplate[]
  // ... rest ...
}
```

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add EventTemplate junction table"
```

---

### Task 1.4: Add SwapRequest Table

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add SwapRequest model**

```prisma
model SwapRequest {
  id               String      @id @default(cuid())
  requesterId      String
  requester        TeamMember  @relation(fields: [requesterId], references: [id])
  fromAssignmentId String
  fromAssignment   Assignment  @relation("SwapFrom", fields: [fromAssignmentId], references: [id])
  toShiftId        String
  toShift          Shift       @relation("SwapTo", fields: [toShiftId], references: [id])
  status           SwapStatus  @default(PENDING)
  matchedWithId    String?     @unique
  matchedWith      SwapRequest? @relation("SwapMatch", fields: [matchedWithId], references: [id])
  matchedBy        SwapRequest? @relation("SwapMatch")
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([requesterId])
  @@index([status])
  @@index([toShiftId])
}
```

**Step 2: Add relations to TeamMember**

```prisma
model TeamMember {
  // ... existing ...
  swapRequests SwapRequest[]
}
```

**Step 3: Add relation to Assignment**

```prisma
model Assignment {
  // ... existing ...
  swapRequestsFrom SwapRequest[] @relation("SwapFrom")
}
```

**Step 4: Add relation to Shift**

```prisma
model Shift {
  // ... existing ...
  swapRequestsTo SwapRequest[] @relation("SwapTo")
}
```

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add SwapRequest table with relations"
```

---

### Task 1.5: Add eventId to ShiftTemplate

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add optional eventId field to ShiftTemplate**

Find `ShiftTemplate` model and add:

```prisma
model ShiftTemplate {
  id                String        @id @default(cuid())
  name              String
  type              ShiftType
  allowedLanes      ShiftType[]   @default([])
  durationMinutes   Int
  startTime         String
  priority          ShiftPriority @default(CORE)
  desirabilityScore Int           @default(3)
  capacity          Int           @default(2)
  color             String?
  
  // NEW: Optional event for event-specific templates
  eventId           String?
  event             Event?        @relation("EventSpecificTemplates", fields: [eventId], references: [id])

  requiredRoles     ShiftTemplateRole[]
  scheduledShifts   ScheduledShift[]
  eventAssignments  EventTemplate[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([eventId])
}
```

**Step 2: Add relation to Event**

```prisma
model Event {
  // ... existing ...
  eventSpecificTemplates ShiftTemplate[] @relation("EventSpecificTemplates")
}
```

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add optional eventId to ShiftTemplate for event-specific templates"
```

---

### Task 1.6: Change ShiftPreference to use PreferenceLevel

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Update ShiftPreference model**

Find `ShiftPreference` and change `priority` to `wantLevel`:

```prisma
model ShiftPreference {
  id           String          @id @default(cuid())
  teamMemberId String
  teamMember   TeamMember      @relation(fields: [teamMemberId], references: [id])
  shiftId      String
  shift        Shift           @relation(fields: [shiftId], references: [id])

  wantLevel    PreferenceLevel  // Changed from: priority Int @default(1)
  notes        String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([teamMemberId, shiftId])
  @@index([shiftId])
}
```

**Step 2: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): change ShiftPreference.priority to wantLevel enum"
```

---

### Task 1.7: Run Migration

**Files:**
- Creates: `prisma/migrations/[timestamp]_v21_schema_updates/migration.sql`

**Step 1: Generate and run migration**

```bash
npx prisma migrate dev --name v21_schema_updates
```

Expected: Migration creates new tables and columns. May prompt about data loss for `priority` column change - accept if dev database.

**Step 2: Generate Prisma Client**

```bash
npx prisma generate
```

Expected: "Prisma Client generated"

**Step 3: Verify schema**

```bash
npx prisma db pull --force
```

Then check `prisma/schema.prisma` matches expected schema.

**Step 4: Commit migration**

```bash
git add prisma/
git commit -m "chore(db): run v21 schema migration"
```

---

## Phase 2: Core APIs

### Task 2.1: Create Event Registration Validation Schema

**Files:**
- Create: `lib/validations/event-registration.ts`

**Step 1: Create validation file**

```typescript
// lib/validations/event-registration.ts
import { z } from "zod";
import { RegistrationStatus } from "@prisma/client";

export const createRegistrationSchema = z.object({
  memberId: z.string().cuid(),
  status: z.nativeEnum(RegistrationStatus).optional().default("REGISTERED"),
});

export const updateRegistrationSchema = z.object({
  status: z.nativeEnum(RegistrationStatus),
});

export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>;
export type UpdateRegistrationInput = z.infer<typeof updateRegistrationSchema>;
```

**Step 2: Commit**

```bash
git add lib/validations/event-registration.ts
git commit -m "feat(validation): add event registration schemas"
```

---

### Task 2.2: Create Event Registrations API - GET/POST

**Files:**
- Create: `app/api/events/[id]/registrations/route.ts`

**Step 1: Create the route file**

```typescript
// app/api/events/[id]/registrations/route.ts
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { createRegistrationSchema } from "@/lib/validations/event-registration";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id: eventId } = await params;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return createNotFoundResponse("Event not found");

    const registrations = await prisma.eventRegistration.findMany({
      where: { eventId },
      include: {
        member: {
          include: {
            attributes: {
              include: { definition: true },
              where: { definition: { eventId } },
            },
          },
        },
      },
      orderBy: { registeredAt: "asc" },
    });

    return createSuccessResponse(registrations);
  } catch (error) {
    console.error("Get event registrations error:", error);
    return createErrorResponse(error, "Failed to fetch registrations");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId } = await params;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return createNotFoundResponse("Event not found");

    const body = await request.json();
    const validated = createRegistrationSchema.parse(body);

    // Check member exists
    const member = await prisma.teamMember.findUnique({
      where: { id: validated.memberId },
    });
    if (!member) return createNotFoundResponse("Member not found");

    // Check not already registered
    const existing = await prisma.eventRegistration.findUnique({
      where: { memberId_eventId: { memberId: validated.memberId, eventId } },
    });
    if (existing) {
      return createErrorResponse(null, "Member already registered for this event", 409);
    }

    const registration = await prisma.eventRegistration.create({
      data: {
        memberId: validated.memberId,
        eventId,
        status: validated.status,
      },
      include: { member: true },
    });

    return createSuccessResponse(registration, 201);
  } catch (error) {
    console.error("Create registration error:", error);
    return createErrorResponse(error, "Failed to register member");
  }
}
```

**Step 2: Commit**

```bash
git add app/api/events/[id]/registrations/route.ts
git commit -m "feat(api): add GET/POST /api/events/[id]/registrations"
```

---

### Task 2.3: Create Event Registration DELETE Endpoint

**Files:**
- Create: `app/api/events/[id]/registrations/[memberId]/route.ts`

**Step 1: Create the route file**

```typescript
// app/api/events/[id]/registrations/[memberId]/route.ts
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { updateRegistrationSchema } from "@/lib/validations/event-registration";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id: eventId, memberId } = await params;

    const registration = await prisma.eventRegistration.findUnique({
      where: { memberId_eventId: { memberId, eventId } },
      include: {
        member: {
          include: {
            attributes: {
              include: { definition: true },
              where: { definition: { eventId } },
            },
          },
        },
      },
    });

    if (!registration) return createNotFoundResponse("Registration not found");

    return createSuccessResponse(registration);
  } catch (error) {
    console.error("Get registration error:", error);
    return createErrorResponse(error, "Failed to fetch registration");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId, memberId } = await params;

    const existing = await prisma.eventRegistration.findUnique({
      where: { memberId_eventId: { memberId, eventId } },
    });
    if (!existing) return createNotFoundResponse("Registration not found");

    const body = await request.json();
    const validated = updateRegistrationSchema.parse(body);

    const updated = await prisma.eventRegistration.update({
      where: { memberId_eventId: { memberId, eventId } },
      data: validated,
      include: { member: true },
    });

    return createSuccessResponse(updated);
  } catch (error) {
    console.error("Update registration error:", error);
    return createErrorResponse(error, "Failed to update registration");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId, memberId } = await params;

    const existing = await prisma.eventRegistration.findUnique({
      where: { memberId_eventId: { memberId, eventId } },
    });
    if (!existing) return createNotFoundResponse("Registration not found");

    await prisma.eventRegistration.delete({
      where: { memberId_eventId: { memberId, eventId } },
    });

    return createSuccessResponse({ deleted: true });
  } catch (error) {
    console.error("Delete registration error:", error);
    return createErrorResponse(error, "Failed to remove registration");
  }
}
```

**Step 2: Commit**

```bash
git add app/api/events/[id]/registrations/[memberId]/route.ts
git commit -m "feat(api): add GET/PUT/DELETE /api/events/[id]/registrations/[memberId]"
```

---

### Task 2.4: Create Event Templates API - GET/POST

**Files:**
- Create: `app/api/events/[id]/templates/route.ts`

**Step 1: Create the route file**

```typescript
// app/api/events/[id]/templates/route.ts
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { z } from "zod";

const assignTemplateSchema = z.object({
  templateId: z.string().cuid(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id: eventId } = await params;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return createNotFoundResponse("Event not found");

    // Get assigned global templates
    const assignments = await prisma.eventTemplate.findMany({
      where: { eventId },
      include: {
        template: {
          include: { requiredRoles: true },
        },
      },
    });

    // Get event-specific templates
    const eventSpecific = await prisma.shiftTemplate.findMany({
      where: { eventId },
      include: { requiredRoles: true },
    });

    return createSuccessResponse({
      assigned: assignments.map((a) => ({
        ...a.template,
        assignmentId: a.id,
        isGlobal: true,
      })),
      eventSpecific: eventSpecific.map((t) => ({
        ...t,
        isGlobal: false,
      })),
    });
  } catch (error) {
    console.error("Get event templates error:", error);
    return createErrorResponse(error, "Failed to fetch templates");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId } = await params;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return createNotFoundResponse("Event not found");

    const body = await request.json();
    const validated = assignTemplateSchema.parse(body);

    // Check template exists and is global
    const template = await prisma.shiftTemplate.findUnique({
      where: { id: validated.templateId },
    });
    if (!template) return createNotFoundResponse("Template not found");
    if (template.eventId) {
      return createErrorResponse(null, "Cannot assign event-specific template to another event", 400);
    }

    // Check not already assigned
    const existing = await prisma.eventTemplate.findUnique({
      where: { eventId_templateId: { eventId, templateId: validated.templateId } },
    });
    if (existing) {
      return createErrorResponse(null, "Template already assigned to this event", 409);
    }

    const assignment = await prisma.eventTemplate.create({
      data: {
        eventId,
        templateId: validated.templateId,
      },
      include: { template: true },
    });

    return createSuccessResponse(assignment, 201);
  } catch (error) {
    console.error("Assign template error:", error);
    return createErrorResponse(error, "Failed to assign template");
  }
}
```

**Step 2: Commit**

```bash
git add app/api/events/[id]/templates/route.ts
git commit -m "feat(api): add GET/POST /api/events/[id]/templates"
```

---

### Task 2.5: Create Event Template DELETE Endpoint

**Files:**
- Create: `app/api/events/[id]/templates/[templateId]/route.ts`

**Step 1: Create the route file**

```typescript
// app/api/events/[id]/templates/[templateId]/route.ts
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId, templateId } = await params;

    const existing = await prisma.eventTemplate.findUnique({
      where: { eventId_templateId: { eventId, templateId } },
    });
    if (!existing) return createNotFoundResponse("Template assignment not found");

    await prisma.eventTemplate.delete({
      where: { eventId_templateId: { eventId, templateId } },
    });

    return createSuccessResponse({ deleted: true });
  } catch (error) {
    console.error("Unassign template error:", error);
    return createErrorResponse(error, "Failed to unassign template");
  }
}
```

**Step 2: Commit**

```bash
git add app/api/events/[id]/templates/[templateId]/route.ts
git commit -m "feat(api): add DELETE /api/events/[id]/templates/[templateId]"
```

---

### Task 2.6: Modify Shift Templates API for Event-Specific

**Files:**
- Modify: `app/api/shifts/templates/route.ts`

**Step 1: Read current implementation**

Run: Review current file at `app/api/shifts/templates/route.ts`

**Step 2: Update GET to accept eventId filter**

Modify the GET handler to support `?eventId=` query parameter:

```typescript
export async function GET(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const includeGlobal = searchParams.get("includeGlobal") !== "false";

    let where: any = {};
    
    if (eventId) {
      // Get templates for specific event: assigned globals + event-specific
      if (includeGlobal) {
        const assignments = await prisma.eventTemplate.findMany({
          where: { eventId },
          select: { templateId: true },
        });
        const assignedIds = assignments.map((a) => a.templateId);
        
        where = {
          OR: [
            { id: { in: assignedIds } },
            { eventId: eventId },
          ],
        };
      } else {
        where = { eventId };
      }
    } else {
      // Get all global templates (no eventId)
      where = { eventId: null };
    }

    const templates = await prisma.shiftTemplate.findMany({
      where,
      include: { requiredRoles: true },
      orderBy: { createdAt: "desc" },
    });

    return createSuccessResponse(templates);
  } catch (error) {
    console.error("Get templates error:", error);
    return createErrorResponse(error, "Failed to fetch templates");
  }
}
```

**Step 3: Update POST to accept optional eventId**

Modify the POST handler:

```typescript
const templateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.nativeEnum(ShiftType),
  durationMinutes: z.number().int().min(15).max(1440),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  priority: z.nativeEnum(ShiftPriority).optional().default("CORE"),
  desirabilityScore: z.number().int().min(1).max(5).optional().default(3),
  capacity: z.number().int().min(1).max(50).optional().default(2),
  color: z.string().optional(),
  eventId: z.string().cuid().optional(), // NEW: for event-specific templates
  requiredRoles: z.array(z.object({
    role: z.nativeEnum(Role),
    count: z.number().int().min(1),
  })).optional(),
});
```

In the POST handler, include eventId in the create:

```typescript
const template = await prisma.shiftTemplate.create({
  data: {
    name: validated.name,
    type: validated.type,
    durationMinutes: validated.durationMinutes,
    startTime: validated.startTime,
    priority: validated.priority,
    desirabilityScore: validated.desirabilityScore,
    capacity: validated.capacity,
    color: validated.color,
    eventId: validated.eventId || null, // NEW
    requiredRoles: validated.requiredRoles ? {
      create: validated.requiredRoles,
    } : undefined,
  },
  include: { requiredRoles: true },
});
```

**Step 4: Commit**

```bash
git add app/api/shifts/templates/route.ts
git commit -m "feat(api): support eventId filter and event-specific templates"
```

---

### Task 2.7: Modify Members API for Event Filtering

**Files:**
- Modify: `app/api/members/route.ts`

**Step 1: Update GET to accept eventId filter**

```typescript
export async function GET(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const includeUnregistered = searchParams.get("includeUnregistered") === "true";

    let where: any = { isActive: true };
    let include: any = {};

    if (eventId) {
      if (includeUnregistered) {
        // Return all members, mark which are registered
        include = {
          eventRegistrations: {
            where: { eventId },
          },
          attributes: {
            where: { definition: { eventId } },
            include: { definition: true },
          },
        };
      } else {
        // Only members registered for this event
        where = {
          ...where,
          eventRegistrations: {
            some: { eventId },
          },
        };
        include = {
          eventRegistrations: {
            where: { eventId },
          },
          attributes: {
            where: { definition: { eventId } },
            include: { definition: true },
          },
        };
      }
    }

    const members = await prisma.teamMember.findMany({
      where,
      include,
      orderBy: { alias: "asc" },
    });

    return createSuccessResponse(members);
  } catch (error) {
    console.error("Get members error:", error);
    return createErrorResponse(error, "Failed to fetch members");
  }
}
```

**Step 2: Commit**

```bash
git add app/api/members/route.ts
git commit -m "feat(api): add eventId filter to members endpoint"
```

---

### Task 2.8: Update Preferences API for WantLevel

**Files:**
- Modify: `app/api/preferences/route.ts`
- Modify: `lib/validations/preference.ts`

**Step 1: Update validation schema**

```typescript
// lib/validations/preference.ts
import { z } from "zod";
import { PreferenceLevel } from "@prisma/client";

export const preferenceSchema = z.object({
  teamMemberId: z.string().cuid(),
  shiftId: z.string().cuid(),
  wantLevel: z.nativeEnum(PreferenceLevel),
  notes: z.string().max(500).optional(),
});

export type PreferenceInput = z.infer<typeof preferenceSchema>;
```

**Step 2: Update preferences route**

```typescript
// app/api/preferences/route.ts
import { preferenceSchema } from "@/lib/validations/preference";

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const body = await request.json();
    const validated = preferenceSchema.parse(body);

    // Upsert - update if exists, create if not
    const preference = await prisma.shiftPreference.upsert({
      where: {
        teamMemberId_shiftId: {
          teamMemberId: validated.teamMemberId,
          shiftId: validated.shiftId,
        },
      },
      update: {
        wantLevel: validated.wantLevel,
        notes: validated.notes,
      },
      create: {
        teamMemberId: validated.teamMemberId,
        shiftId: validated.shiftId,
        wantLevel: validated.wantLevel,
        notes: validated.notes,
      },
    });

    return createSuccessResponse(preference);
  } catch (error) {
    console.error("Create preference error:", error);
    return createErrorResponse(error, "Failed to save preference");
  }
}

export async function DELETE(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const teamMemberId = searchParams.get("teamMemberId");
    const shiftId = searchParams.get("shiftId");

    if (!teamMemberId || !shiftId) {
      return createErrorResponse(null, "teamMemberId and shiftId required", 400);
    }

    await prisma.shiftPreference.delete({
      where: {
        teamMemberId_shiftId: { teamMemberId, shiftId },
      },
    });

    return createSuccessResponse({ deleted: true });
  } catch (error) {
    console.error("Delete preference error:", error);
    return createErrorResponse(error, "Failed to delete preference");
  }
}
```

**Step 3: Commit**

```bash
git add lib/validations/preference.ts app/api/preferences/route.ts
git commit -m "feat(api): update preferences to use wantLevel enum with upsert"
```

---

### Task 2.9: Wire EventConfig Save

**Files:**
- Modify: `app/api/events/[id]/config/route.ts`

**Step 1: Review and update PUT handler**

Ensure the PUT handler actually saves to database:

```typescript
// app/api/events/[id]/config/route.ts
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { z } from "zod";

const configSchema = z.object({
  minShiftsPerPerson: z.number().int().min(0).max(50).optional(),
  algorithmWeights: z.object({
    fairness: z.number().min(0).max(100),
    preferences: z.number().min(0).max(100),
  }).optional(),
  balanceThresholds: z.object({
    maxShiftsPerPerson: z.number().int().min(1).max(50),
    minRestHours: z.number().int().min(0).max(24),
  }).optional(),
  autoAssignUnfilled: z.boolean().optional(),
  bufferDaysBefore: z.number().int().min(0).max(30).optional(),
  bufferDaysAfter: z.number().int().min(0).max(30).optional(),
  allocationRules: z.array(z.object({
    shiftType: z.string(),
    attribute: z.string(),
    operator: z.enum(["EQUALS", "NOT_EQUALS", "CONTAINS"]),
    value: z.string(),
  })).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id: eventId } = await params;

    const config = await prisma.eventConfig.findUnique({
      where: { eventId },
    });

    if (!config) {
      // Return default config if none exists
      return createSuccessResponse({
        eventId,
        minShiftsPerPerson: 2,
        algorithmWeights: { fairness: 50, preferences: 50 },
        balanceThresholds: { maxShiftsPerPerson: 12, minRestHours: 8 },
        autoAssignUnfilled: true,
        bufferDaysBefore: 1,
        bufferDaysAfter: 1,
      });
    }

    return createSuccessResponse(config);
  } catch (error) {
    console.error("Get config error:", error);
    return createErrorResponse(error, "Failed to fetch config");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId } = await params;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return createNotFoundResponse("Event not found");

    const body = await request.json();
    const validated = configSchema.parse(body);

    const config = await prisma.eventConfig.upsert({
      where: { eventId },
      update: {
        minShiftsPerPerson: validated.minShiftsPerPerson,
        algorithmWeights: validated.algorithmWeights,
        balanceThresholds: validated.balanceThresholds,
        autoAssignUnfilled: validated.autoAssignUnfilled,
        bufferDaysBefore: validated.bufferDaysBefore,
        bufferDaysAfter: validated.bufferDaysAfter,
      },
      create: {
        eventId,
        minShiftsPerPerson: validated.minShiftsPerPerson ?? 2,
        algorithmWeights: validated.algorithmWeights ?? { fairness: 50, preferences: 50 },
        balanceThresholds: validated.balanceThresholds ?? { maxShiftsPerPerson: 12, minRestHours: 8 },
        autoAssignUnfilled: validated.autoAssignUnfilled ?? true,
        bufferDaysBefore: validated.bufferDaysBefore ?? 1,
        bufferDaysAfter: validated.bufferDaysAfter ?? 1,
      },
    });

    return createSuccessResponse(config);
  } catch (error) {
    console.error("Update config error:", error);
    return createErrorResponse(error, "Failed to update config");
  }
}
```

**Step 2: Commit**

```bash
git add app/api/events/[id]/config/route.ts
git commit -m "feat(api): wire EventConfig GET/PUT with proper save"
```

---

### Task 2.10: Create Swap Requests API

**Files:**
- Create: `lib/validations/swap-request.ts`
- Create: `app/api/swap-requests/route.ts`
- Create: `app/api/swap-requests/[id]/route.ts`

**Step 1: Create validation schema**

```typescript
// lib/validations/swap-request.ts
import { z } from "zod";
import { SwapStatus } from "@prisma/client";

export const createSwapRequestSchema = z.object({
  fromAssignmentId: z.string().cuid(),
  toShiftId: z.string().cuid(),
});

export const updateSwapRequestSchema = z.object({
  status: z.nativeEnum(SwapStatus),
});

export type CreateSwapRequestInput = z.infer<typeof createSwapRequestSchema>;
export type UpdateSwapRequestInput = z.infer<typeof updateSwapRequestSchema>;
```

**Step 2: Create main route**

```typescript
// app/api/swap-requests/route.ts
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { createSwapRequestSchema } from "@/lib/validations/swap-request";

export async function GET(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");
    const eventId = searchParams.get("eventId");
    const status = searchParams.get("status");

    let where: any = {};

    if (memberId) {
      where.requesterId = memberId;
    }

    if (eventId) {
      where.toShift = { eventId };
    }

    if (status) {
      where.status = status;
    }

    const requests = await prisma.swapRequest.findMany({
      where,
      include: {
        requester: true,
        fromAssignment: {
          include: { shift: true },
        },
        toShift: true,
        matchedWith: {
          include: { requester: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return createSuccessResponse(requests);
  } catch (error) {
    console.error("Get swap requests error:", error);
    return createErrorResponse(error, "Failed to fetch swap requests");
  }
}

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const body = await request.json();
    const validated = createSwapRequestSchema.parse(body);

    // Get assignment and verify ownership
    const assignment = await prisma.assignment.findUnique({
      where: { id: validated.fromAssignmentId },
      include: { shift: true },
    });
    if (!assignment) return createNotFoundResponse("Assignment not found");

    // Get target shift
    const toShift = await prisma.shift.findUnique({
      where: { id: validated.toShiftId },
    });
    if (!toShift) return createNotFoundResponse("Target shift not found");

    // Verify same event
    if (assignment.shift.eventId !== toShift.eventId) {
      return createErrorResponse(null, "Cannot swap shifts between different events", 400);
    }

    // Create swap request
    const swapRequest = await prisma.swapRequest.create({
      data: {
        requesterId: assignment.teamMemberId,
        fromAssignmentId: validated.fromAssignmentId,
        toShiftId: validated.toShiftId,
      },
      include: {
        requester: true,
        fromAssignment: { include: { shift: true } },
        toShift: true,
      },
    });

    // Check for matching swap request (someone on toShift wanting fromShift)
    const matchingRequest = await prisma.swapRequest.findFirst({
      where: {
        status: "PENDING",
        toShiftId: assignment.shiftId,
        fromAssignment: {
          shiftId: validated.toShiftId,
        },
        id: { not: swapRequest.id },
      },
    });

    if (matchingRequest) {
      // Auto-match!
      await prisma.$transaction([
        prisma.swapRequest.update({
          where: { id: swapRequest.id },
          data: { status: "MATCHED", matchedWithId: matchingRequest.id },
        }),
        prisma.swapRequest.update({
          where: { id: matchingRequest.id },
          data: { status: "MATCHED" },
        }),
      ]);
    }

    return createSuccessResponse(swapRequest, 201);
  } catch (error) {
    console.error("Create swap request error:", error);
    return createErrorResponse(error, "Failed to create swap request");
  }
}
```

**Step 3: Create individual route**

```typescript
// app/api/swap-requests/[id]/route.ts
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { updateSwapRequestSchema } from "@/lib/validations/swap-request";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id } = await params;

    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id },
      include: {
        requester: true,
        fromAssignment: { include: { shift: true, teamMember: true } },
        toShift: true,
        matchedWith: { include: { requester: true } },
      },
    });

    if (!swapRequest) return createNotFoundResponse("Swap request not found");

    return createSuccessResponse(swapRequest);
  } catch (error) {
    console.error("Get swap request error:", error);
    return createErrorResponse(error, "Failed to fetch swap request");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required to approve/decline");

    const { id } = await params;

    const existing = await prisma.swapRequest.findUnique({
      where: { id },
      include: {
        fromAssignment: true,
        matchedWith: { include: { fromAssignment: true } },
      },
    });
    if (!existing) return createNotFoundResponse("Swap request not found");

    const body = await request.json();
    const validated = updateSwapRequestSchema.parse(body);

    // If approving a matched swap, execute the swap
    if (validated.status === "APPROVED" && existing.status === "MATCHED" && existing.matchedWith) {
      await prisma.$transaction([
        // Update assignments
        prisma.assignment.update({
          where: { id: existing.fromAssignmentId },
          data: { shiftId: existing.toShiftId },
        }),
        prisma.assignment.update({
          where: { id: existing.matchedWith.fromAssignmentId },
          data: { shiftId: existing.fromAssignment.shiftId },
        }),
        // Update swap requests
        prisma.swapRequest.update({
          where: { id },
          data: { status: "APPROVED" },
        }),
        prisma.swapRequest.update({
          where: { id: existing.matchedWithId! },
          data: { status: "APPROVED" },
        }),
      ]);
    } else {
      await prisma.swapRequest.update({
        where: { id },
        data: { status: validated.status },
      });
    }

    const updated = await prisma.swapRequest.findUnique({
      where: { id },
      include: {
        requester: true,
        fromAssignment: { include: { shift: true } },
        toShift: true,
      },
    });

    return createSuccessResponse(updated);
  } catch (error) {
    console.error("Update swap request error:", error);
    return createErrorResponse(error, "Failed to update swap request");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id } = await params;

    const existing = await prisma.swapRequest.findUnique({ where: { id } });
    if (!existing) return createNotFoundResponse("Swap request not found");

    if (existing.status !== "PENDING") {
      return createErrorResponse(null, "Can only cancel pending requests", 400);
    }

    await prisma.swapRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return createSuccessResponse({ cancelled: true });
  } catch (error) {
    console.error("Cancel swap request error:", error);
    return createErrorResponse(error, "Failed to cancel swap request");
  }
}
```

**Step 4: Commit**

```bash
git add lib/validations/swap-request.ts app/api/swap-requests/
git commit -m "feat(api): add swap requests endpoints with auto-matching"
```

---

### Task 2.11: Add Algorithm Preview to Assignments API

**Files:**
- Modify: `app/api/assignments/route.ts`

**Step 1: Add preview mode to POST**

Add query parameter handling:

```typescript
export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { searchParams } = new URL(request.url);
    const preview = searchParams.get("preview") === "true";
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return createErrorResponse(null, "eventId required", 400);
    }

    // Get event config
    const config = await prisma.eventConfig.findUnique({
      where: { eventId },
    });

    // Get shifts for event
    const shifts = await prisma.shift.findMany({
      where: { eventId },
      include: { assignments: true, preferences: true },
    });

    // Get registered members
    const registrations = await prisma.eventRegistration.findMany({
      where: { eventId, status: "CONFIRMED" },
      include: {
        member: {
          include: {
            attributes: {
              where: { definition: { eventId } },
              include: { definition: true },
            },
            assignments: {
              where: { shift: { eventId } },
            },
            preferences: {
              where: { shift: { eventId } },
            },
          },
        },
      },
    });

    const members = registrations.map((r) => r.member);

    // Run algorithm (imported from lib/algorithm/optimizer.ts)
    const { runOptimizer } = await import("@/lib/algorithm/optimizer");
    const proposedAssignments = await runOptimizer({
      shifts,
      members,
      config: config || undefined,
      existingAssignments: shifts.flatMap((s) => s.assignments),
    });

    if (preview) {
      // Return proposed assignments without saving
      return createSuccessResponse({
        preview: true,
        proposedAssignments,
        summary: {
          totalAssignments: proposedAssignments.length,
          shiftsFullyCovered: shifts.filter((s) => {
            const assigned = proposedAssignments.filter((a) => a.shiftId === s.id);
            return assigned.length >= s.capacity;
          }).length,
          totalShifts: shifts.length,
        },
      });
    }

    // Actually create assignments
    const created = await prisma.$transaction(
      proposedAssignments.map((a) =>
        prisma.assignment.create({
          data: {
            shiftId: a.shiftId,
            teamMemberId: a.teamMemberId,
            role: a.role,
            assignmentType: "ALGORITHM",
            algorithmScore: a.score,
          },
        })
      )
    );

    return createSuccessResponse({
      created: created.length,
      assignments: created,
    });
  } catch (error) {
    console.error("Run assignment algorithm error:", error);
    return createErrorResponse(error, "Failed to run assignment algorithm");
  }
}
```

**Step 2: Commit**

```bash
git add app/api/assignments/route.ts
git commit -m "feat(api): add preview mode to assignments algorithm"
```

---

### Task 2.12: Wire Audit Rollback

**Files:**
- Modify: `app/api/audit/rollback/route.ts`

**Step 1: Implement actual rollback**

```typescript
// app/api/audit/rollback/route.ts
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { z } from "zod";

const rollbackSchema = z.object({
  logId: z.string().cuid(),
});

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const body = await request.json();
    const { logId } = rollbackSchema.parse(body);

    const log = await prisma.auditLog.findUnique({ where: { id: logId } });
    if (!log) return createNotFoundResponse("Audit log not found");

    if (!["UPDATE", "DELETE"].includes(log.action)) {
      return createErrorResponse(null, "Can only rollback UPDATE or DELETE actions", 400);
    }

    if (!log.before) {
      return createErrorResponse(null, "No previous state to rollback to", 400);
    }

    const beforeState = log.before as Record<string, any>;

    // Perform rollback based on entity type
    let result: any;

    switch (log.entityType) {
      case "SHIFT":
        if (log.action === "DELETE") {
          result = await prisma.shift.create({ data: beforeState });
        } else {
          result = await prisma.shift.update({
            where: { id: log.entityId },
            data: beforeState,
          });
        }
        break;

      case "TEAM_MEMBER":
        if (log.action === "DELETE") {
          result = await prisma.teamMember.create({ data: beforeState });
        } else {
          result = await prisma.teamMember.update({
            where: { id: log.entityId },
            data: beforeState,
          });
        }
        break;

      case "ASSIGNMENT":
        if (log.action === "DELETE") {
          result = await prisma.assignment.create({ data: beforeState });
        } else {
          result = await prisma.assignment.update({
            where: { id: log.entityId },
            data: beforeState,
          });
        }
        break;

      case "EVENT":
        if (log.action === "DELETE") {
          result = await prisma.event.create({ data: beforeState });
        } else {
          result = await prisma.event.update({
            where: { id: log.entityId },
            data: beforeState,
          });
        }
        break;

      default:
        return createErrorResponse(null, `Rollback not supported for ${log.entityType}`, 400);
    }

    // Create audit log for the rollback
    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: log.entityType,
        entityId: log.entityId,
        before: log.after,
        after: beforeState,
        reason: `Rollback of ${log.action} from ${log.createdAt.toISOString()}`,
      },
    });

    return createSuccessResponse({
      rolledBack: true,
      entityType: log.entityType,
      entityId: log.entityId,
      result,
    });
  } catch (error) {
    console.error("Rollback error:", error);
    return createErrorResponse(error, "Failed to rollback");
  }
}
```

**Step 2: Commit**

```bash
git add app/api/audit/rollback/route.ts
git commit -m "feat(api): implement actual audit rollback functionality"
```

---

## Phase 3: Event Context

### Task 3.1: Create Event Context Hook

**Files:**
- Create: `lib/hooks/useEventContext.ts`

**Step 1: Create the hook**

```typescript
// lib/hooks/useEventContext.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { unwrapApiResponse } from "@/lib/api-errors";

interface Event {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface EventContextState {
  selectedEventId: string | null;
  selectedEvent: Event | null;
  events: Event[];
  loading: boolean;
  setSelectedEventId: (id: string | null) => void;
  refreshEvents: () => Promise<void>;
}

const STORAGE_KEY_USER = "selectedEventId";
const STORAGE_KEY_ADMIN = "adminSelectedEventId";

export function useEventContext(isAdmin: boolean = false): EventContextState {
  const storageKey = isAdmin ? STORAGE_KEY_ADMIN : STORAGE_KEY_USER;
  
  const [selectedEventId, setSelectedEventIdState] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const setSelectedEventId = useCallback((id: string | null) => {
    setSelectedEventIdState(id);
    if (id) {
      localStorage.setItem(storageKey, id);
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  const refreshEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        const eventsList = unwrapApiResponse<Event[]>(data) || [];
        setEvents(eventsList);
        return eventsList;
      }
    } catch (error) {
      console.error("Failed to load events:", error);
    }
    return [];
  }, []);

  // Load events and restore selection on mount
  useEffect(() => {
    async function init() {
      setLoading(true);
      const eventsList = await refreshEvents();
      
      const savedId = localStorage.getItem(storageKey);
      if (savedId && eventsList.some((e) => e.id === savedId)) {
        setSelectedEventIdState(savedId);
      }
      
      setLoading(false);
    }
    init();
  }, [storageKey, refreshEvents]);

  // Load selected event details when ID changes
  useEffect(() => {
    if (selectedEventId) {
      const event = events.find((e) => e.id === selectedEventId);
      setSelectedEvent(event || null);
    } else {
      setSelectedEvent(null);
    }
  }, [selectedEventId, events]);

  return {
    selectedEventId,
    selectedEvent,
    events,
    loading,
    setSelectedEventId,
    refreshEvents,
  };
}
```

**Step 2: Commit**

```bash
git add lib/hooks/useEventContext.ts
git commit -m "feat(hooks): add useEventContext for event selection persistence"
```

---

### Task 3.2: Create Member Context Hook

**Files:**
- Create: `lib/hooks/useMemberContext.ts`

**Step 1: Create the hook**

```typescript
// lib/hooks/useMemberContext.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { unwrapApiResponse } from "@/lib/api-errors";

interface Member {
  id: string;
  alias: string;
  avatarId: string;
  experienceLevel: string;
  isAdmin: boolean;
}

interface MemberContextState {
  selectedMemberId: string | null;
  selectedMember: Member | null;
  loading: boolean;
  setSelectedMemberId: (id: string | null) => void;
  refreshMember: () => Promise<void>;
}

const STORAGE_KEY = "selectedMemberId";

export function useMemberContext(): MemberContextState {
  const [selectedMemberId, setSelectedMemberIdState] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  const setSelectedMemberId = useCallback((id: string | null) => {
    setSelectedMemberIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const refreshMember = useCallback(async () => {
    const id = selectedMemberId || localStorage.getItem(STORAGE_KEY);
    if (!id) {
      setSelectedMember(null);
      return;
    }

    try {
      const res = await fetch(`/api/members/${id}`);
      if (res.ok) {
        const data = await res.json();
        const member = unwrapApiResponse<Member>(data);
        setSelectedMember(member);
      }
    } catch (error) {
      console.error("Failed to load member:", error);
    }
  }, [selectedMemberId]);

  // Restore selection on mount
  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
      setSelectedMemberIdState(savedId);
    }
    setLoading(false);
  }, []);

  // Load member details when ID changes
  useEffect(() => {
    if (selectedMemberId) {
      refreshMember();
    } else {
      setSelectedMember(null);
    }
  }, [selectedMemberId, refreshMember]);

  return {
    selectedMemberId,
    selectedMember,
    loading,
    setSelectedMemberId,
    refreshMember,
  };
}
```

**Step 2: Commit**

```bash
git add lib/hooks/useMemberContext.ts
git commit -m "feat(hooks): add useMemberContext for identity selection"
```

---

### Task 3.3: Create Event Selector Component

**Files:**
- Create: `components/ui/EventSelector.tsx`

**Step 1: Create the component**

```typescript
// components/ui/EventSelector.tsx
"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Event {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface EventSelectorProps {
  events: Event[];
  selectedEventId: string | null;
  onSelect: (eventId: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function EventSelector({
  events,
  selectedEventId,
  onSelect,
  placeholder = "Select an event",
  className,
  disabled = false,
}: EventSelectorProps) {
  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className={cn("relative", className)}>
      <select
        value={selectedEventId || ""}
        onChange={(e) => onSelect(e.target.value)}
        disabled={disabled}
        className={cn(
          "appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-10",
          "text-sm font-medium text-gray-700",
          "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "cursor-pointer min-w-[200px]"
        )}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {events.map((event) => (
          <option key={event.id} value={event.id}>
            {event.name}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/ui/EventSelector.tsx
git commit -m "feat(ui): add EventSelector dropdown component"
```

---

### Task 3.4: Update Header with Identity and Event Display

**Files:**
- Modify: `components/layout/Header.tsx`

**Step 1: Update Header component**

Add identity display and event selector. Find the Header component and update:

```typescript
// components/layout/Header.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EventSelector } from "@/components/ui/EventSelector";
import { useEventContext } from "@/lib/hooks/useEventContext";
import { useMemberContext } from "@/lib/hooks/useMemberContext";
import { cn } from "@/lib/utils";

interface HeaderProps {
  isAdmin?: boolean;
}

export function Header({ isAdmin = false }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const { selectedMember } = useMemberContext();
  const { 
    selectedEventId, 
    selectedEvent, 
    events, 
    setSelectedEventId,
    loading: eventsLoading 
  } = useEventContext(isAdmin);

  const isAdminRoute = pathname?.startsWith("/admin");

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      localStorage.removeItem("selectedMemberId");
      localStorage.removeItem("selectedEventId");
      localStorage.removeItem("adminSelectedEventId");
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  // Build identity display string
  const identityDisplay = selectedMember
    ? `${selectedMember.avatarId} ${selectedMember.alias}`
    : null;

  const contextDisplay = selectedEvent
    ? `${identityDisplay} • ${selectedEvent.name}`
    : identityDisplay;

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href={isAdminRoute ? "/admin/setup" : "/app/calendar"} className="flex items-center gap-2">
            <span className="text-xl font-black text-primary-600">ShiftAware</span>
          </Link>

          {/* Center: Event Selector (admin only) */}
          {isAdminRoute && !eventsLoading && (
            <div className="hidden md:flex items-center">
              <EventSelector
                events={events}
                selectedEventId={selectedEventId}
                onSelect={setSelectedEventId}
                placeholder="Select event..."
              />
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Identity + Event display */}
            {contextDisplay && (
              <Link
                href="/app/identity"
                className="hidden md:flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                <span>{contextDisplay}</span>
              </Link>
            )}

            {/* Role badge */}
            <span className={cn(
              "hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
              isAdminRoute 
                ? "bg-primary-100 text-primary-700" 
                : "bg-gray-100 text-gray-600"
            )}>
              {isAdminRoute ? "Admin" : "User"}
            </span>

            {/* Logout */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Logout</span>
            </Button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <MobileSidebar
          isAdmin={isAdminRoute}
          onClose={() => setMobileMenuOpen(false)}
          events={events}
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
        />
      )}
    </header>
  );
}

// Mobile sidebar component
function MobileSidebar({
  isAdmin,
  onClose,
  events,
  selectedEventId,
  onSelectEvent,
}: {
  isAdmin: boolean;
  onClose: () => void;
  events: any[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
}) {
  const userNavItems = [
    { label: "Calendar", href: "/app/calendar", icon: "📆" },
    { label: "Switch Identity", href: "/app/identity", icon: "👤" },
  ];

  const adminNavItems = [
    { label: "Event Setup", href: "/admin/setup", icon: "⚙️" },
    { label: "Shift Schedule", href: "/admin/shifts/schedule", icon: "📅" },
    { label: "Team Management", href: "/admin/team", icon: "👥" },
    { label: "Audit Log", href: "/admin/audit", icon: "📜" },
  ];

  const navItems = isAdmin ? adminNavItems : userNavItems;

  return (
    <div className="md:hidden bg-white border-t border-gray-100 shadow-lg">
      <div className="px-4 py-4 space-y-4">
        {/* Event selector for admin mobile */}
        {isAdmin && (
          <div className="pb-4 border-b border-gray-100">
            <EventSelector
              events={events}
              selectedEventId={selectedEventId}
              onSelect={(id) => {
                onSelectEvent(id);
                onClose();
              }}
              placeholder="Select event..."
              className="w-full"
            />
          </div>
        )}

        {/* Nav items */}
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span>{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}

        {/* Admin/User switch */}
        {isAdmin ? (
          <Link
            href="/app/calendar"
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors border-t border-gray-100 mt-4 pt-4"
          >
            <span>🔙</span>
            <span className="font-medium">Back to User View</span>
          </Link>
        ) : (
          <Link
            href="/admin/setup"
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors border-t border-gray-100 mt-4 pt-4"
          >
            <span>⚡</span>
            <span className="font-medium">Admin Panel</span>
          </Link>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/layout/Header.tsx
git commit -m "feat(header): add identity display and event selector"
```

---

### Task 3.5: Update AdminSidebar Order

**Files:**
- Modify: `components/layout/AdminSidebar.tsx`

**Step 1: Swap nav item order**

Find the `navItems` array and reorder:

```typescript
const navItems = [
  { label: "Event Setup", href: "/admin/setup", icon: Settings },
  { label: "Shift Schedule", href: "/admin/shifts/schedule", icon: Calendar },  // Moved up
  { label: "Team Management", href: "/admin/team", icon: Users },  // Moved down
  { label: "Audit Log", href: "/admin/audit", icon: FileText },
];
```

**Step 2: Commit**

```bash
git add components/layout/AdminSidebar.tsx
git commit -m "fix(nav): reorder admin sidebar - schedule before team"
```

---

### Task 3.6: Update UserSidebar with Identity Link

**Files:**
- Modify: `components/layout/UserSidebar.tsx`

**Step 1: Add Switch Identity link**

```typescript
import { CalendarDays, Download, UserCircle, Settings } from "lucide-react";

const navItems = [
  { label: "Calendar", href: "/app/calendar", icon: CalendarDays },
  { label: "Switch Identity", href: "/app/identity", icon: UserCircle },
];
```

Also remove or update any Export link since we're removing that page.

**Step 2: Commit**

```bash
git add components/layout/UserSidebar.tsx
git commit -m "feat(nav): add identity link, remove export page link"
```

---

## Phase 4: Identity Page

> **Status:** UI exists, API wiring needed for attributes

### Task 4.1: Wire Profile Creation Attributes to API

**Files:**
- Modify: `app/app/identity/components/CreateProfileForm.tsx`

**Step 1: Update handleSubmit to save member attributes**

The form already collects attributes, but we need to save them to the database after creating the member. Update the parent component's `handleCreateProfile`:

```typescript
// In app/app/identity/page.tsx, update handleCreateProfile:
const handleCreateProfile = async (profileData: any) => {
  try {
    // Create the member
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alias: profileData.alias,
        avatarId: profileData.avatarId,
        experienceLevel: profileData.experienceLevel,
        genderRole: profileData.genderRole,
        capabilities: profileData.capabilities,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      alert(error.message || "Failed to create profile");
      return;
    }

    const data = await res.json();
    const newMemberId = data.data.id;

    // If eventId provided, create registration
    if (profileData.eventId) {
      const regRes = await fetch(`/api/events/${profileData.eventId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: newMemberId }),
      });

      if (!regRes.ok) {
        console.error("Failed to register for event");
      }

      // Save event-specific attributes
      if (profileData.attributes && Object.keys(profileData.attributes).length > 0) {
        for (const [key, value] of Object.entries(profileData.attributes)) {
          await fetch(`/api/members/${newMemberId}/attributes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId: profileData.eventId,
              key,
              value,
            }),
          });
        }
      }
    }

    setSelectedMemberId(newMemberId);
    setShowCreateForm(false);
    setShowEventSelection(true);
  } catch (error) {
    console.error("Failed to create profile:", error);
    alert("Failed to create profile");
  }
};
```

**Step 2: Commit**

```bash
git add app/app/identity/page.tsx
git commit -m "feat(identity): wire profile creation to save attributes"
```

---

### Task 4.2: Add Member Attributes API Endpoint

**Files:**
- Create: `app/api/members/[id]/attributes/route.ts`

**Step 1: Create the route file**

```typescript
// app/api/members/[id]/attributes/route.ts
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { z } from "zod";

const createAttributeSchema = z.object({
  eventId: z.string().cuid(),
  key: z.string().min(1),
  value: z.union([z.string(), z.boolean(), z.array(z.string())]),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id: memberId } = await params;
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    const where: any = { memberId };
    if (eventId) {
      where.definition = { eventId };
    }

    const attributes = await prisma.teamMemberAttribute.findMany({
      where,
      include: { definition: true },
    });

    return createSuccessResponse(attributes);
  } catch (error) {
    console.error("Get member attributes error:", error);
    return createErrorResponse(error, "Failed to fetch attributes");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id: memberId } = await params;

    const member = await prisma.teamMember.findUnique({ where: { id: memberId } });
    if (!member) return createNotFoundResponse("Member not found");

    const body = await request.json();
    const validated = createAttributeSchema.parse(body);

    // Find attribute definition
    const definition = await prisma.eventAttributeDefinition.findFirst({
      where: {
        eventId: validated.eventId,
        name: validated.key,
      },
    });

    if (!definition) {
      return createNotFoundResponse(`Attribute definition '${validated.key}' not found for this event`);
    }

    // Upsert attribute value
    const attribute = await prisma.teamMemberAttribute.upsert({
      where: {
        teamMemberId_definitionId: {
          teamMemberId: memberId,
          definitionId: definition.id,
        },
      },
      update: {
        value: JSON.stringify(validated.value),
      },
      create: {
        teamMemberId: memberId,
        definitionId: definition.id,
        value: JSON.stringify(validated.value),
      },
      include: { definition: true },
    });

    return createSuccessResponse(attribute, 201);
  } catch (error) {
    console.error("Create member attribute error:", error);
    return createErrorResponse(error, "Failed to save attribute");
  }
}
```

**Step 2: Commit**

```bash
git add app/api/members/[id]/attributes/route.ts
git commit -m "feat(api): add member attributes GET/POST endpoint"
```

---

## Phase 5: Admin Setup

> **Status:** ✅ COMPLETE - All UI components exist and are wired to APIs

The following components are already fully implemented:
- `TemplateManager.tsx` - Template assignment with checkboxes, event-specific creation
- `AttributeDefinitions.tsx` - Full CRUD for event attribute definitions
- `FestivalSettings.tsx` - Event settings form with buffer days

---

## Phase 6: Lane Calendar Enhancements

> **Status:** Base components exist, need time-based positioning and export

### Task 6.1: Add Time-Based Horizontal Positioning to ShiftBlock

**Files:**
- Modify: `components/features/LaneCalendar/ShiftBlock.tsx`

**Step 1: Update ShiftBlock to use time-based positioning**

The current implementation already calculates position based on time. Verify it works correctly with the parent container.

The existing code at lines 43-48 already calculates:
```typescript
const totalMinutes = differenceInMinutes(dayEnd, dayStart);
const startMinutes = Math.max(0, differenceInMinutes(start, dayStart));
const endMinutes = Math.min(totalMinutes, differenceInMinutes(end, dayStart));

const left = (startMinutes / totalMinutes) * 100;
const width = ((endMinutes - startMinutes) / totalMinutes) * 100;
```

This is correct. The component is already time-positioned.

**Step 2: Commit (verification only)**

```bash
git add components/features/LaneCalendar/ShiftBlock.tsx
git commit -m "verify(calendar): ShiftBlock time positioning is correct"
```

---

### Task 6.2: Add Export Button with html2canvas

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

**Step 1: Install html2canvas if not present**

```bash
npm install html2canvas
```

**Step 2: Add export functionality to schedule page**

Find the schedule page and add an export button. Add this to the component:

```typescript
import html2canvas from 'html2canvas';
import { Download } from 'lucide-react';

// Add ref for calendar container
const calendarRef = useRef<HTMLDivElement>(null);

// Add export function
async function handleExportCalendar() {
  if (!calendarRef.current) return;
  
  try {
    const canvas = await html2canvas(calendarRef.current, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    });
    
    const link = document.createElement('a');
    link.download = `shift-schedule-${format(new Date(), 'yyyy-MM-dd')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    toast.success('Schedule exported successfully');
  } catch (error) {
    console.error('Export failed:', error);
    toast.error('Failed to export schedule');
  }
}

// Add button to toolbar
<Button variant="secondary" onClick={handleExportCalendar}>
  <Download className="w-4 h-4 mr-2" />
  Export
</Button>

// Wrap calendar in ref
<div ref={calendarRef}>
  <LaneCalendarView ... />
</div>
```

**Step 3: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx package.json package-lock.json
git commit -m "feat(calendar): add export to PNG with html2canvas"
```

---

### Task 6.3: Add Dual Time Rulers (Top and Bottom)

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarView.tsx`

**Step 1: Import and add TimeRuler components**

```typescript
import { TimeRuler } from './TimeRuler';

// In the render, add time rulers before and after lane rows:

// After header row, before lane rows:
{days.map((day) => (
  <TimeRuler
    key={`ruler-top-${format(day, "yyyy-MM-dd")}`}
    startTime={startOfDay(day)}
    endTime={addDays(startOfDay(day), 1)}
    position="top"
  />
))}

// After lane rows:
{days.map((day) => (
  <TimeRuler
    key={`ruler-bottom-${format(day, "yyyy-MM-dd")}`}
    startTime={startOfDay(day)}
    endTime={addDays(startOfDay(day), 1)}
    position="bottom"
  />
))}
```

**Step 2: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarView.tsx
git commit -m "feat(calendar): add time rulers at top and bottom"
```

---

## Phase 7: User Features

> **Status:** UI exists with TODOs, need to wire to APIs

### Task 7.1: Wire Voting Buttons to Preferences API

**Files:**
- Modify: `app/app/calendar/page.tsx`

**Step 1: Update vote handlers to call API**

Replace the TODO implementations:

```typescript
async function handleVoteWant(shiftId: string) {
  const memberId = localStorage.getItem('selectedMemberId');
  if (!memberId) {
    toast.error('Please select your identity first');
    return;
  }

  try {
    const res = await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamMemberId: memberId,
        shiftId,
        wantLevel: 'WANT',
      }),
    });

    if (res.ok) {
      toast.success('Preference saved: Want this shift');
      refetchShifts();
    } else {
      const error = await res.json();
      toast.error(error.message || 'Failed to save preference');
    }
  } catch (error) {
    console.error('Failed to save preference:', error);
    toast.error('Failed to save preference');
  }
}

async function handleVoteDontWant(shiftId: string) {
  const memberId = localStorage.getItem('selectedMemberId');
  if (!memberId) {
    toast.error('Please select your identity first');
    return;
  }

  try {
    const res = await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamMemberId: memberId,
        shiftId,
        wantLevel: 'DONT_WANT',
      }),
    });

    if (res.ok) {
      toast.success('Preference saved: Don\'t want this shift');
      refetchShifts();
    } else {
      const error = await res.json();
      toast.error(error.message || 'Failed to save preference');
    }
  } catch (error) {
    console.error('Failed to save preference:', error);
    toast.error('Failed to save preference');
  }
}
```

**Step 2: Add toast import if not present**

```typescript
import { useToast } from '@/components/ui/Toast';

// In component:
const toast = useToast();
```

**Step 3: Commit**

```bash
git add app/app/calendar/page.tsx
git commit -m "feat(user): wire voting buttons to preferences API"
```

---

### Task 7.2: Wire Swap Request Flow

**Files:**
- Modify: `app/app/calendar/page.tsx`
- Modify: `app/app/calendar/components/MyShiftsList.tsx`

**Step 1: Create swap request modal state and handler**

Add to the calendar page:

```typescript
const [swapModalOpen, setSwapModalOpen] = useState(false);
const [swapFromAssignmentId, setSwapFromAssignmentId] = useState<string | null>(null);
const [availableShifts, setAvailableShifts] = useState<Shift[]>([]);

async function handleRequestSwap(assignmentId: string) {
  setSwapFromAssignmentId(assignmentId);
  
  // Find the assignment to get the current shift
  const assignment = shifts
    .flatMap(s => s.assignments.map(a => ({ ...a, shiftId: s.id, eventId: s.event.id })))
    .find(a => a.id === assignmentId);
  
  if (!assignment) {
    toast.error('Assignment not found');
    return;
  }

  // Fetch available shifts for swap (same event, different from current)
  try {
    const res = await fetch(`/api/shifts?eventId=${assignment.eventId}`);
    if (res.ok) {
      const data = await res.json();
      const allShifts = unwrapApiResponse<Shift[]>(data) || [];
      // Filter out shifts user is already assigned to
      const memberId = localStorage.getItem('selectedMemberId');
      const available = allShifts.filter(s => 
        s.id !== assignment.shiftId &&
        !s.assignments.some(a => a.teamMember.id === memberId)
      );
      setAvailableShifts(available);
      setSwapModalOpen(true);
    }
  } catch (error) {
    console.error('Failed to fetch shifts:', error);
    toast.error('Failed to load available shifts');
  }
}

async function handleSubmitSwapRequest(toShiftId: string) {
  if (!swapFromAssignmentId) return;

  try {
    const res = await fetch('/api/swap-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAssignmentId: swapFromAssignmentId,
        toShiftId,
      }),
    });

    if (res.ok) {
      toast.success('Swap request submitted');
      setSwapModalOpen(false);
      setSwapFromAssignmentId(null);
    } else {
      const error = await res.json();
      toast.error(error.message || 'Failed to submit swap request');
    }
  } catch (error) {
    console.error('Failed to submit swap request:', error);
    toast.error('Failed to submit swap request');
  }
}
```

**Step 2: Add swap modal UI**

Add after the MyShiftsList component:

```typescript
{/* Swap Request Modal */}
{swapModalOpen && (
  <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
    <Card className="max-w-xl w-full bg-white border-none shadow-2xl rounded-3xl overflow-hidden">
      <div className="bg-primary-600 p-6 text-white">
        <h2 className="text-xl font-bold">Request Shift Swap</h2>
        <p className="text-primary-100 text-sm mt-1">
          Select the shift you'd like to swap to
        </p>
      </div>
      <div className="p-6 max-h-96 overflow-y-auto space-y-3">
        {availableShifts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No available shifts to swap to
          </p>
        ) : (
          availableShifts.map(shift => (
            <button
              key={shift.id}
              onClick={() => handleSubmitSwapRequest(shift.id)}
              className="w-full p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all text-left"
            >
              <div className="font-bold text-gray-900">
                {shift.type.replace(/_/g, ' ')}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {format(new Date(shift.startTime), 'EEE, dd.MM.yyyy HH:mm')} - 
                {format(new Date(shift.endTime), 'HH:mm')}
              </div>
            </button>
          ))
        )}
      </div>
      <div className="p-6 border-t border-gray-100 flex justify-end">
        <Button
          variant="secondary"
          onClick={() => {
            setSwapModalOpen(false);
            setSwapFromAssignmentId(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </Card>
  </div>
)}
```

**Step 3: Commit**

```bash
git add app/app/calendar/page.tsx app/app/calendar/components/MyShiftsList.tsx
git commit -m "feat(user): wire swap request flow to API"
```

---

## Phase 8: Admin Team Management

> **Status:** Member management exists but not event-scoped

### Task 8.1: Add Event Filter to Team Management

**Files:**
- Modify: `app/admin/team/page.tsx`

**Step 1: Embed member list with event filter**

Update the members tab content:

```typescript
import { useEventContext } from '@/lib/hooks/useEventContext';
import { MemberListByEvent } from './components/MemberListByEvent';

// In component:
const { selectedEventId, selectedEvent } = useEventContext(true);

// Replace the placeholder content:
{activeTab === 'members' && (
  <Card className="p-6">
    {selectedEventId ? (
      <MemberListByEvent eventId={selectedEventId} eventName={selectedEvent?.name || ''} />
    ) : (
      <div className="text-center py-8 text-gray-500">
        Please select an event from the header dropdown to manage team members.
      </div>
    )}
  </Card>
)}
```

**Step 2: Create MemberListByEvent component**

Create file `app/admin/team/components/MemberListByEvent.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Plus, UserMinus, Edit, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { unwrapApiResponse } from '@/lib/api-errors';
import { EmojiPicker } from '@/components/ui/EmojiPicker';

interface Member {
  id: string;
  alias: string;
  avatarId: string;
  experienceLevel: string;
  eventRegistrations?: { status: string }[];
}

interface MemberListByEventProps {
  eventId: string;
  eventName: string;
}

export function MemberListByEvent({ eventId, eventName }: MemberListByEventProps) {
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMembers();
  }, [eventId]);

  async function loadMembers() {
    setLoading(true);
    try {
      // Load registered members
      const res = await fetch(`/api/members?eventId=${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(unwrapApiResponse<Member[]>(data) || []);
      }

      // Load all members for add picker
      const allRes = await fetch(`/api/members?eventId=${eventId}&includeUnregistered=true`);
      if (allRes.ok) {
        const data = await allRes.json();
        setAllMembers(unwrapApiResponse<Member[]>(data) || []);
      }
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember(memberId: string) {
    try {
      const res = await fetch(`/api/events/${eventId}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });

      if (res.ok) {
        toast.success('Member added to event');
        loadMembers();
        setShowAddPicker(false);
      } else {
        const error = await res.json();
        toast.error(error.message || 'Failed to add member');
      }
    } catch (error) {
      toast.error('Failed to add member');
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('Remove this member from the event? Their shifts will be unassigned.')) {
      return;
    }

    try {
      const res = await fetch(`/api/events/${eventId}/registrations/${memberId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Member removed from event');
        loadMembers();
      } else {
        const error = await res.json();
        toast.error(error.message || 'Failed to remove member');
      }
    } catch (error) {
      toast.error('Failed to remove member');
    }
  }

  const unregisteredMembers = allMembers.filter(
    m => !m.eventRegistrations || m.eventRegistrations.length === 0
  );

  const filteredMembers = members.filter(m =>
    m.alias.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="text-gray-500">Loading members...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Team Members for {eventName}
          </h3>
          <p className="text-sm text-gray-500">
            {members.length} members registered
          </p>
        </div>
        <Button onClick={() => setShowAddPicker(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Existing Member
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-3">
        {filteredMembers.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            No members registered for this event yet
          </Card>
        ) : (
          filteredMembers.map(member => (
            <Card key={member.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-2xl">{member.avatarId}</span>
                <div>
                  <div className="font-bold text-gray-900">{member.alias}</div>
                  <div className="text-sm text-gray-500">{member.experienceLevel}</div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveMember(member.id)}
                className="text-red-600 hover:bg-red-50"
              >
                <UserMinus className="w-4 h-4" />
              </Button>
            </Card>
          ))
        )}
      </div>

      {/* Add Member Picker Modal */}
      {showAddPicker && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-white p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Existing Member</h3>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {unregisteredMembers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  All members are already registered for this event
                </p>
              ) : (
                unregisteredMembers.map(member => (
                  <button
                    key={member.id}
                    onClick={() => handleAddMember(member.id)}
                    className="w-full p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all flex items-center gap-3 text-left"
                  >
                    <span className="text-2xl">{member.avatarId}</span>
                    <div>
                      <div className="font-medium text-gray-900">{member.alias}</div>
                      <div className="text-xs text-gray-500">{member.experienceLevel}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={() => setShowAddPicker(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add app/admin/team/page.tsx app/admin/team/components/MemberListByEvent.tsx
git commit -m "feat(team): add event-scoped member management"
```

---

## Phase 9: Allocation Settings

> **Status:** UI exists with TODOs, need to wire to EventConfig API

### Task 9.1: Wire Distribution Settings to EventConfig API

**Files:**
- Modify: `app/admin/team/components/DistributionSettings.tsx`

**Step 1: Update to load and save from EventConfig**

```typescript
import { useEventContext } from '@/lib/hooks/useEventContext';
import { useEffect } from 'react';
import { unwrapApiResponse } from '@/lib/api-errors';

// In component, add event context:
const { selectedEventId } = useEventContext(true);

// Load config on mount/event change
useEffect(() => {
  if (selectedEventId) {
    loadConfig();
  }
}, [selectedEventId]);

async function loadConfig() {
  try {
    const res = await fetch(`/api/events/${selectedEventId}/config`);
    if (res.ok) {
      const data = await res.json();
      const cfg = unwrapApiResponse<any>(data);
      if (cfg) {
        setConfig({
          fairnessWeight: cfg.algorithmWeights?.fairness || 50,
          preferenceWeight: cfg.algorithmWeights?.preferences || 30,
          maxShiftsPerPerson: cfg.balanceThresholds?.maxShiftsPerPerson || 12,
          minRestHours: cfg.balanceThresholds?.minRestHours || 8,
          attributeRules: cfg.allocationRules || [],
        });
      }
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

// Update handleSave:
async function handleSave() {
  if (!selectedEventId) {
    toast.error('Please select an event first');
    return;
  }

  try {
    const res = await fetch(`/api/events/${selectedEventId}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        algorithmWeights: {
          fairness: config.fairnessWeight,
          preferences: config.preferenceWeight,
        },
        balanceThresholds: {
          maxShiftsPerPerson: config.maxShiftsPerPerson,
          minRestHours: config.minRestHours,
        },
        allocationRules: config.attributeRules,
      }),
    });

    if (res.ok) {
      toast.success('Distribution settings saved');
    } else {
      const error = await res.json();
      toast.error(error.message || 'Failed to save settings');
    }
  } catch (error) {
    toast.error('Failed to save settings');
  }
}

// Update handlePreview:
async function handlePreview() {
  if (!selectedEventId) {
    toast.error('Please select an event first');
    return;
  }

  setPreviewLoading(true);
  try {
    const res = await fetch(`/api/assignments?preview=true&eventId=${selectedEventId}`, {
      method: 'POST',
    });

    if (res.ok) {
      const data = await res.json();
      const result = unwrapApiResponse<any>(data);
      alert(`Preview: ${result.summary.totalAssignments} assignments proposed for ${result.summary.shiftsFullyCovered}/${result.summary.totalShifts} shifts`);
    } else {
      const error = await res.json();
      toast.error(error.message || 'Failed to preview');
    }
  } catch (error) {
    toast.error('Failed to preview algorithm results');
  } finally {
    setPreviewLoading(false);
  }
}
```

**Step 2: Add event check at top of render**

```typescript
if (!selectedEventId) {
  return (
    <div className="text-center py-8 text-gray-500">
      Please select an event from the header dropdown to configure allocation settings.
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add app/admin/team/components/DistributionSettings.tsx
git commit -m "feat(allocation): wire distribution settings to EventConfig API"
```

---

## Phase 10: Cleanup

> **Status:** ✅ COMPLETE - Already done by previous implementation

The following cleanup tasks were completed:
- ✅ Removed `/app/export` page
- ✅ Updated route references
- ✅ Verified audit rollback UI is wired
- ✅ Navigation fixes complete

---

## Verification Checklist

After all tasks complete, verify:

- [x] Can create member and register for event (Phase 4)
- [x] Can select identity and event in user flow (Phase 3 - Complete)
- [x] Admin event selector persists across pages (Phase 3 - Complete)
- [x] Templates filter by assigned event (Phase 5 - Complete)
- [ ] Lane calendar shows time rulers top and bottom (Phase 6)
- [x] Can drag template to specific time (Existing)
- [x] Shift blocks position by time (Existing)
- [x] Resize handles work with 15-min snap (Existing)
- [x] Click shift edits in sidebar (Existing)
- [ ] Export captures current view (Phase 6)
- [ ] Voting buttons save to DB (Phase 7)
- [ ] Swap requests create and match (Phase 7)
- [ ] Team members show by event (Phase 8)
- [ ] Allocation settings save to EventConfig (Phase 9)
- [x] Rollback actually reverts changes (Phase 10 - Complete)
- [ ] All tests pass

---

## Remaining Work Summary

| Phase | Status | Tasks Remaining |
|-------|--------|-----------------|
| Phase 1-3 | ✅ Complete | 0 |
| Phase 4: Identity | 🔧 API wiring | 2 tasks |
| Phase 5: Admin Setup | ✅ Complete | 0 |
| Phase 6: Lane Calendar | 🔧 Enhancements | 3 tasks |
| Phase 7: User Features | 🔧 API wiring | 2 tasks |
| Phase 8: Admin Team | 🔧 Event scoping | 1 task |
| Phase 9: Allocation | 🔧 API wiring | 1 task |
| Phase 10: Cleanup | ✅ Complete | 0 |

**Total remaining tasks: 9**

---

**Plan fully specified and saved to `docs/plans/2026-02-01-shiftaware-v21-implementation.md`.**
