# ShiftAware v2.1 Bugfixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 5 bugs preventing v2.1 components from interlinking as designed.

**Architecture:** These are surgical fixes to existing code - no new features. Each fix targets a specific file with minimal changes to restore intended functionality.

**Tech Stack:** Next.js 15, React 19, TypeScript, Prisma, Zod

**Reference:** `docs/plans/2026-02-01-shiftaware-v21-complete-design.md`

---

## Task 1: Fix TemplateManager API Response Parsing

**Problem:** `/api/events/[id]/templates` returns `{ assigned: [], eventSpecific: [] }` but TemplateManager expects an array.

**Files:**
- Modify: `app/admin/setup/components/TemplateManager.tsx`

**Step 1: Update the response parsing**

Find lines 73-88 and replace the assigned templates loading logic:

```typescript
// OLD (broken):
const assigned = unwrapApiResponse<any[]>(data) || [];
setAssignedTemplateIds(
  new Set(assigned.map((a: any) => a.templateId || a.template?.id)),
);

// NEW (fixed):
const response = unwrapApiResponse<{ assigned: any[]; eventSpecific: any[] }>(data);
const assignedList = response?.assigned || [];
setAssignedTemplateIds(
  new Set(assignedList.map((a: any) => a.id || a.templateId)),
);
```

**Step 2: Verify the fix**

1. Start dev server: `npm run dev`
2. Navigate to `/admin/setup` → Shift Templates tab
3. Select an event from header dropdown
4. Expected: Global templates list should populate with checkboxes

**Step 3: Commit**

```bash
git add app/admin/setup/components/TemplateManager.tsx
git commit -m "fix(templates): parse API response object instead of array"
```

---

## Task 2: Fix MemberListByEvent Empty State Message

**Problem:** Shows "All members already registered" even when no members exist at all.

**Files:**
- Modify: `app/admin/team/components/MemberListByEvent.tsx`

**Step 1: Update the empty state condition**

Find the modal content around line 193-198 and update:

```typescript
// OLD (misleading):
{unregisteredMembers.length === 0 ? (
  <p className="text-gray-500 text-center py-4">
    All members are already registered for this event
  </p>
) : (

// NEW (accurate):
{allMembers.length === 0 ? (
  <p className="text-gray-500 text-center py-4">
    No members exist yet. Create members first.
  </p>
) : unregisteredMembers.length === 0 ? (
  <p className="text-gray-500 text-center py-4">
    All members are already registered for this event
  </p>
) : (
```

**Step 2: Verify the fix**

1. Navigate to `/admin/team` → Team Members tab
2. Click "Add Existing Member"
3. If no members exist: should see "No members exist yet"
4. If members exist but all registered: should see "All members already registered"

**Step 3: Commit**

```bash
git add app/admin/team/components/MemberListByEvent.tsx
git commit -m "fix(members): distinguish empty database from all-registered state"
```

---

## Task 3: Fix Mobile Navigation Routes

**Problem:** Mobile sidebar links to old routes that no longer exist.

**Files:**
- Modify: `components/layout/Header.tsx`

**Step 1: Fix Admin Panel link**

Find line ~259 and change:

```typescript
// OLD:
href="/admin/festival/setup"

// NEW:
href="/admin/setup"
```

**Step 2: Fix Back to User View link**

Find line ~272 and change:

```typescript
// OLD:
href="/app/dashboard"

// NEW:
href="/app/calendar"
```

**Step 3: Verify the fix**

1. Open dev tools → mobile view (or use phone)
2. Open hamburger menu
3. Click "Admin Panel" → should go to `/admin/setup`
4. Click "Back to User View" → should go to `/app/calendar`

**Step 4: Commit**

```bash
git add components/layout/Header.tsx
git commit -m "fix(nav): update mobile sidebar routes to current paths"
```

---

## Task 4: Add Missing Events Update API

**Problem:** `PUT /api/events/[id]` doesn't exist - can't edit events.

**Files:**
- Create: `app/api/events/[id]/route.ts`

**Step 1: Create the route file**

```typescript
// app/api/events/[id]/route.ts
import { NextRequest } from "next/server";
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

const updateEventSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  startDate: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid date").optional(),
  endDate: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid date").optional(),
  status: z.enum(["PLANNING", "OPEN_FOR_PREFERENCES", "ASSIGNING", "FINALIZED", "COMPLETED"]).optional(),
  bufferDaysBefore: z.number().int().min(0).max(30).optional(),
  bufferDaysAfter: z.number().int().min(0).max(30).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id } = await params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        config: true,
        _count: { select: { shifts: true, registrations: true } },
      },
    });

    if (!event) return createNotFoundResponse("Event");

    return createSuccessResponse(event);
  } catch (error) {
    console.error("Get event error:", error);
    return createErrorResponse(error, "Failed to fetch event");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id } = await params;

    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) return createNotFoundResponse("Event");

    const body = await request.json();
    const validated = updateEventSchema.parse(body);

    // Update event and config in transaction
    const event = await prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id },
        data: {
          ...(validated.name && { name: validated.name }),
          ...(validated.startDate && { startDate: new Date(validated.startDate) }),
          ...(validated.endDate && { endDate: new Date(validated.endDate) }),
          ...(validated.status && { status: validated.status }),
        },
      });

      // Update config if buffer days provided
      if (validated.bufferDaysBefore !== undefined || validated.bufferDaysAfter !== undefined) {
        await tx.eventConfig.upsert({
          where: { eventId: id },
          update: {
            ...(validated.bufferDaysBefore !== undefined && { bufferDaysBefore: validated.bufferDaysBefore }),
            ...(validated.bufferDaysAfter !== undefined && { bufferDaysAfter: validated.bufferDaysAfter }),
          },
          create: {
            eventId: id,
            minShiftsPerPerson: 2,
            bufferDaysBefore: validated.bufferDaysBefore ?? 1,
            bufferDaysAfter: validated.bufferDaysAfter ?? 1,
            algorithmWeights: {},
            balanceThresholds: {},
            autoAssignUnfilled: true,
          },
        });
      }

      return updated;
    });

    const fullEvent = await prisma.event.findUnique({
      where: { id },
      include: { config: true },
    });

    return createSuccessResponse(fullEvent);
  } catch (error) {
    console.error("Update event error:", error);
    return createErrorResponse(error, "Failed to update event");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id } = await params;

    const existing = await prisma.event.findUnique({
      where: { id },
      include: { _count: { select: { shifts: true } } },
    });

    if (!existing) return createNotFoundResponse("Event");

    if (existing._count.shifts > 0) {
      return createErrorResponse(
        null,
        "Cannot delete event with existing shifts. Delete shifts first.",
        400
      );
    }

    await prisma.$transaction([
      prisma.eventConfig.deleteMany({ where: { eventId: id } }),
      prisma.eventRegistration.deleteMany({ where: { eventId: id } }),
      prisma.eventTemplate.deleteMany({ where: { eventId: id } }),
      prisma.event.delete({ where: { id } }),
    ]);

    return createSuccessResponse({ deleted: true });
  } catch (error) {
    console.error("Delete event error:", error);
    return createErrorResponse(error, "Failed to delete event");
  }
}
```

**Step 2: Verify the fix**

1. Navigate to `/admin/setup` → Event Settings tab
2. Select an existing event from dropdown
3. Edit the name or dates
4. Click "Update Event"
5. Expected: Toast shows "Event updated" and changes persist

**Step 3: Commit**

```bash
git add app/api/events/[id]/route.ts
git commit -m "feat(api): add GET/PUT/DELETE /api/events/[id] endpoint"
```

---

## Task 5: Add Assignment Preview Mode

**Problem:** Preview button deletes existing assignments instead of just showing proposal.

**Files:**
- Modify: `app/api/assignments/route.ts`

**Step 1: Update POST handler to support preview mode**

Replace the entire POST function:

```typescript
export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const preview = searchParams.get("preview") === "true";
    const eventIdParam = searchParams.get("eventId");

    // Support eventId from query params OR body
    const body = await request.json().catch(() => ({}));
    const eventId = eventIdParam || body.eventId;

    if (!eventId) {
      return createErrorResponse(
        new Error("eventId is required"),
        "eventId is required (in query params or body)",
        400,
      );
    }

    // Get event and config
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { config: true },
    });

    if (!event) {
      return createNotFoundResponse("Event");
    }

    // Get REGISTERED members for this event (not all members)
    const registrations = await prisma.eventRegistration.findMany({
      where: { 
        eventId,
        status: { in: ["REGISTERED", "CONFIRMED"] },
      },
      include: {
        member: {
          include: {
            preferences: {
              where: { shift: { eventId } },
              include: { shift: true },
            },
            assignments: {
              where: { shift: { eventId } },
              include: { shift: true },
            },
            attributes: {
              where: { definition: { eventId } },
              include: { definition: true },
            },
          },
        },
      },
    });

    const members = registrations.map((r) => r.member);

    if (members.length === 0) {
      return createErrorResponse(
        null,
        "No members registered for this event. Register members first.",
        400,
      );
    }

    // Get all shifts for event
    const shifts = await prisma.shift.findMany({
      where: { eventId },
      include: {
        preferences: {
          include: { teamMember: true },
        },
        assignments: {
          include: { teamMember: true },
        },
        requiredRoles: true,
        event: true,
      },
      orderBy: { startTime: "asc" },
    });

    if (shifts.length === 0) {
      return createErrorResponse(
        null,
        "No shifts exist for this event. Create shifts first.",
        400,
      );
    }

    // Get core shifts (priority = CORE)
    const coreShifts = shifts.filter((s) => s.priority === "CORE");

    // Run algorithm
    const config = event.config || {
      minShiftsPerPerson: 2,
      algorithmWeights: {
        preferenceMatch: 0.35,
        experienceBalance: 0.25,
        workloadFairness: 0.15,
        coreShiftCoverage: 0.05,
      },
    };

    const weights =
      typeof config.algorithmWeights === "object" &&
      config.algorithmWeights !== null
        ? (config.algorithmWeights as any)
        : {
            preferenceMatch: 0.35,
            experienceBalance: 0.25,
            workloadFairness: 0.15,
            coreShiftCoverage: 0.05,
          };

    const result = await runAssignmentAlgorithm(members as any, shifts as any, {
      minShiftsPerPerson: config.minShiftsPerPerson || 2,
      coreShifts,
      weights,
    });

    // PREVIEW MODE: Return results without saving
    if (preview) {
      return createSuccessResponse({
        preview: true,
        proposedAssignments: result.assignments,
        summary: {
          totalAssignments: result.assignments.length,
          totalMembers: members.length,
          totalShifts: shifts.length,
          shiftsFullyCovered: shifts.filter((s) => {
            const assignedCount = result.assignments.filter(
              (a) => a.shiftId === s.id
            ).length;
            return assignedCount >= s.capacity;
          }).length,
        },
        violations: result.violations,
      });
    }

    // EXECUTE MODE: Delete existing and save new assignments
    await prisma.assignment.deleteMany({
      where: { shift: { eventId } },
    });

    const savedAssignments = await prisma.$transaction(
      result.assignments.map((assignment) =>
        prisma.assignment.create({
          data: {
            shiftId: assignment.shiftId,
            teamMemberId: assignment.teamMemberId,
            role: assignment.role,
            isLead: assignment.isLead || false,
            assignmentType: assignment.assignmentType,
            algorithmScore: result.scores.get(
              `${assignment.teamMemberId}-${assignment.shiftId}`,
            )
              ? (result.scores.get(
                  `${assignment.teamMemberId}-${assignment.shiftId}`,
                ) as any)
              : null,
            notes:
              result.explanations.get(
                `${assignment.teamMemberId}-${assignment.shiftId}`,
              ) || null,
          },
          include: {
            shift: true,
            teamMember: true,
          },
        }),
      ),
    );

    await createAuditLog({
      action: AuditAction.ASSIGNMENT_RUN,
      entityType: EntityType.CONFIG,
      entityId: eventId,
      after: {
        assignmentsCount: savedAssignments.length,
        violations: result.violations,
      },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return createSuccessResponse({
      preview: false,
      assignments: savedAssignments,
      violations: result.violations,
      scores: Object.fromEntries(result.scores),
      explanations: Object.fromEntries(result.explanations),
    });
  } catch (error) {
    console.error("Run assignment algorithm error:", error);
    return createErrorResponse(error, "Failed to run assignment algorithm");
  }
}
```

**Step 2: Verify the fix**

1. Navigate to `/admin/team` → Allocation & Distribution tab
2. Select an event with shifts and registered members
3. Click "Preview Results"
4. Expected: Shows summary without deleting existing assignments
5. Check shifts still have their original assignments

**Step 3: Commit**

```bash
git add app/api/assignments/route.ts
git commit -m "feat(api): add preview mode and use registered members only"
```

---

## Final Verification

After all tasks complete, verify end-to-end:

1. **Templates:** Admin Setup → Shift Templates shows global templates with checkboxes
2. **Members:** Team Management shows correct empty states
3. **Navigation:** Mobile menu links work correctly
4. **Events:** Can edit existing event name/dates in Event Settings
5. **Preview:** Distribution Settings preview doesn't destroy data

---

## Summary

| Task | Files | Type |
|------|-------|------|
| 1 | TemplateManager.tsx | Fix response parsing |
| 2 | MemberListByEvent.tsx | Fix empty state logic |
| 3 | Header.tsx | Fix route strings |
| 4 | events/[id]/route.ts | Create new API route |
| 5 | assignments/route.ts | Add preview mode |

**Total: 5 tasks, ~30 minutes estimated**
