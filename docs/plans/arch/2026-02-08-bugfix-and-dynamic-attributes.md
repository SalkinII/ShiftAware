# Bugfix & Dynamic Attributes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 10 identified bugs across the UI, API, and algorithm layers, and migrate `genderRole` from a hardcoded TeamMember field to the dynamic EventAttributeDefinition system.

**Architecture:** All changes follow the three-layer pattern (Repository → Service → Route). No direct Prisma calls in routes. UI loads data through API endpoints backed by services.

**Tech Stack:** Next.js 14 (App Router), Prisma ORM, PostgreSQL, Zod validation, Vitest

---

## Bug Inventory

| # | Bug | Severity | Group |
|---|-----|----------|-------|
| 1 | Create Profile 500: invalid capabilities (DRIVER/FIRST_AID not in Role enum) | Critical | A |
| 2 | No genderRole UI field (hardcoded "unspecified") | Critical | C |
| 3 | Event selection broken for users (onClick does nothing) | Critical | D |
| 4 | Algorithm preview: "Unexpected end of JSON input" (empty POST body + response shape mismatch) | Critical | A |
| 5 | Global template creation: "Request validation failed" (eventId null vs undefined) | High | A |
| 6 | Team attribute creation: "Request validation failed" | High | A |
| 7 | Broken "Create templates" link → /admin/shifts/templates (doesn't exist) | High | A |
| 8 | Hardcoded attribute dropdowns in DistributionSettings | Medium | B |
| 9 | Inconsistent gender values (M_NB/FLINTA vs M/FINTA) | Medium | C |
| 10 | CreateProfileForm reads attr.key but API returns attr.name | Medium | A |

---

## Group A: Quick Fixes (No Schema Change)

### Task 1: Fix broken "Create templates" link

**Files:**
- Modify: `components/features/TemplatePalette/TemplatePalette.tsx:111`

**Step 1: Fix the link**

Change:
```typescript
href="/admin/shifts/templates"
```
To:
```typescript
href="/admin/setup"
```

**Step 2: Verify**

Run: `npx tsc --noEmit` — should have no new errors.

**Step 3: Commit**

```bash
git add components/features/TemplatePalette/TemplatePalette.tsx
git commit -m "fix(ui): correct broken 'Create templates' link to /admin/setup"
```

---

### Task 2: Fix template validation — eventId null vs undefined

**Files:**
- Modify: `lib/validations/template.ts:22`

**Problem:** `TemplateManager.tsx` sends `eventId: null` for global templates, but Zod schema has `z.string().cuid().optional()` which rejects `null`.

**Step 1: Fix the Zod schema**

In `lib/validations/template.ts`, change:
```typescript
eventId: z.string().cuid().optional(),
```
To:
```typescript
eventId: z.string().cuid().nullable().optional(),
```

This accepts `string | null | undefined`.

**Step 2: Run existing tests**

Run: `npx vitest run tests/unit/ --reporter=verbose`
Expected: All existing tests pass (no tests directly cover this schema).

**Step 3: Commit**

```bash
git add lib/validations/template.ts
git commit -m "fix(validation): accept null eventId for global templates"
```

---

### Task 3: Fix CreateProfileForm — invalid capabilities

**Files:**
- Modify: `app/app/identity/components/CreateProfileForm.tsx:43-47`

**Problem:** `CAPABILITIES` array includes `"DRIVER"` and `"FIRST_AID"` which are not in the `Role` enum (`TEAM_MEMBER | SHIFT_LEAD | SUPER`). When checked, Zod validation fails with 500.

**Step 1: Fix the CAPABILITIES constant**

Change:
```typescript
const CAPABILITIES = [
  { value: "SHIFT_LEAD", label: "Shift Lead" },
  { value: "DRIVER", label: "Driver" },
  { value: "FIRST_AID", label: "First Aid" },
];
```
To:
```typescript
const CAPABILITIES = [
  { value: "SHIFT_LEAD", label: "Shift Lead" },
  { value: "SUPER", label: "Supervisor" },
];
```

Note: `TEAM_MEMBER` is already included by default in the form state (`capabilities: ["TEAM_MEMBER"]`). The checkboxes are for additional capabilities.

**Step 2: Verify**

Run: `npx tsc --noEmit` — no new errors.

**Step 3: Commit**

```bash
git add app/app/identity/components/CreateProfileForm.tsx
git commit -m "fix(identity): use valid Role enum values for capabilities checkboxes"
```

---

### Task 4: Fix CreateProfileForm — attr.key vs attr.name

**Files:**
- Modify: `app/app/identity/components/CreateProfileForm.tsx`

**Problem:** The `AttributeDefinition` interface uses `key: string` but the API returns `name: string` from `EventAttributeDefinition`. This causes dynamic attribute fields to not render/bind correctly.

**Step 1: Fix the interface and all references**

In `app/app/identity/components/CreateProfileForm.tsx`:

Change the interface:
```typescript
interface AttributeDefinition {
  id: string;
  key: string;
  label: string;
  type: "BOOLEAN" | "SELECT" | "MULTISELECT" | "TEXT";
  required: boolean;
  options?: string[];
}
```
To:
```typescript
interface AttributeDefinition {
  id: string;
  name: string;
  label: string;
  type: "BOOLEAN" | "SELECT" | "MULTISELECT" | "TEXT";
  required: boolean;
  options?: string[];
}
```

Then replace every `attr.key` with `attr.name` throughout the component. There should be references in:
- The BOOLEAN checkbox: `formData.attributes?.[attr.key]` → `formData.attributes?.[attr.name]`
- The TEXT input: `formData.attributes?.[attr.key]` → `formData.attributes?.[attr.name]`
- The SELECT dropdown: `formData.attributes?.[attr.key]` → `formData.attributes?.[attr.name]`
- The MULTISELECT checkboxes: `formData.attributes?.[attr.key]` → `formData.attributes?.[attr.name]`
- All `handleAttributeChange(attr.key, ...)` → `handleAttributeChange(attr.name, ...)`

**Step 2: Verify**

Run: `npx tsc --noEmit` — no new errors.

**Step 3: Commit**

```bash
git add app/app/identity/components/CreateProfileForm.tsx
git commit -m "fix(identity): use attr.name instead of attr.key to match API response"
```

---

### Task 5: Fix attribute definition validation

**Files:**
- Modify: `lib/validations/attribute.ts:5`

**Problem:** The name regex `/^[a-z_]+$/` rejects names with numbers (e.g., "level_2"). While the seed data doesn't use numbers, this is unnecessarily restrictive.

**Step 1: Relax the regex**

Change:
```typescript
name: z.string().min(1).max(50).regex(/^[a-z_]+$/, "Use lowercase with underscores"),
```
To:
```typescript
name: z.string().min(1).max(50).regex(/^[a-z][a-z0-9_]*$/, "Must start with lowercase letter, use only lowercase letters, numbers, and underscores"),
```

**Step 2: Run existing tests**

Run: `npx vitest run tests/unit/ --reporter=verbose`

**Step 3: Commit**

```bash
git add lib/validations/attribute.ts
git commit -m "fix(validation): allow numbers in attribute definition names"
```

---

### Task 6: Fix algorithm preview — empty body + response shape

**Files:**
- Modify: `app/admin/team/components/DistributionSettings.tsx:121-141`

**Problem 1:** POST request has no body, but `app/api/assignments/route.ts:55` calls `await request.json()` → "Unexpected end of JSON input".

**Problem 2:** UI expects `result.summary.totalAssignments` but the service returns `{ assignments, violations, scores, explanations }`.

**Step 1: Fix the fetch call to include JSON body**

In `DistributionSettings.tsx`, change the `handlePreview` function's fetch call:

```typescript
const res = await fetch(
  `/api/assignments?preview=true&eventId=${selectedEventId}`,
  {
    method: "POST",
  },
);
```
To:
```typescript
const res = await fetch("/api/assignments", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    eventId: selectedEventId,
    preview: true,
  }),
});
```

**Step 2: Fix the response handling to match actual shape**

Change:
```typescript
if (res.ok) {
  const data = await res.json();
  const result = unwrapApiResponse<any>(data);
  alert(
    `Preview: ${result.summary.totalAssignments} assignments proposed for ${result.summary.shiftsFullyCovered}/${result.summary.totalShifts} shifts`,
  );
}
```
To:
```typescript
if (res.ok) {
  const data = await res.json();
  const result = unwrapApiResponse<any>(data);
  const totalAssignments = result.assignments?.length || 0;
  const totalViolations = result.violations?.length || 0;
  alert(
    `Preview: ${totalAssignments} assignments proposed. ${totalViolations} constraint violations detected.`,
  );
}
```

**Step 3: Verify**

Run: `npx tsc --noEmit` — no new errors.

**Step 4: Commit**

```bash
git add app/admin/team/components/DistributionSettings.tsx
git commit -m "fix(allocation): send JSON body for preview and fix response shape handling"
```

---

## Group B: Dynamic Attributes in DistributionSettings

### Task 7: Load event attribute definitions dynamically

**Files:**
- Modify: `app/admin/team/components/DistributionSettings.tsx`

**Context:** The attribute dropdown currently hardcodes `experience_level` and `can_drive`. It should load from `GET /api/events/{id}/attributes` which is backed by `EventsService.listEventAttributes()` → `EventRepository.listEventAttributes()`. The architecture is already in place — we just need to call it from the UI.

**Step 1: Add state and fetch for attribute definitions**

At the top of the component (near existing state declarations), add:

```typescript
const [attributeDefinitions, setAttributeDefinitions] = useState<
  Array<{ id: string; name: string; label: string; type: string; options: string[] }>
>([]);

useEffect(() => {
  if (selectedEventId) {
    fetchAttributeDefinitions(selectedEventId);
  }
}, [selectedEventId]);

async function fetchAttributeDefinitions(eventId: string) {
  try {
    const res = await fetch(`/api/events/${eventId}/attributes`);
    if (res.ok) {
      const data = await res.json();
      setAttributeDefinitions(data.data || []);
    }
  } catch (error) {
    console.error("Failed to fetch attribute definitions:", error);
  }
}
```

**Step 2: Replace hardcoded attribute dropdown with dynamic options**

Change the hardcoded attribute `<select>`:
```typescript
<select
  value={rule.attribute}
  onChange={(e) =>
    handleUpdateRule(rule.id, "attribute", e.target.value)
  }
  className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
>
  <option value="experience_level">Experience Level</option>
  <option value="can_drive">Can Drive</option>
</select>
```
To:
```typescript
<select
  value={rule.attribute}
  onChange={(e) =>
    handleUpdateRule(rule.id, "attribute", e.target.value)
  }
  className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
>
  <option value="">Select attribute...</option>
  {attributeDefinitions.map((attr) => (
    <option key={attr.id} value={attr.name}>
      {attr.label}
    </option>
  ))}
</select>
```

**Step 3: Replace the hardcoded value text input with dynamic options**

When an attribute is selected that has options (SELECT/MULTISELECT type), show a dropdown instead of a free-text input. Change the value `<input>`:

```typescript
<input
  type="text"
  value={rule.value}
  onChange={(e) =>
    handleUpdateRule(rule.id, "value", e.target.value)
  }
  placeholder="Value..."
  className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
/>
```
To:
```typescript
{(() => {
  const selectedAttr = attributeDefinitions.find(a => a.name === rule.attribute);
  if (selectedAttr && selectedAttr.options && selectedAttr.options.length > 0) {
    return (
      <select
        value={rule.value}
        onChange={(e) => handleUpdateRule(rule.id, "value", e.target.value)}
        className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option value="">Select value...</option>
        {selectedAttr.options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      type="text"
      value={rule.value}
      onChange={(e) => handleUpdateRule(rule.id, "value", e.target.value)}
      placeholder="Value..."
      className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
    />
  );
})()}
```

**Step 4: Verify**

Run: `npx tsc --noEmit` — no new errors.

**Step 5: Commit**

```bash
git add app/admin/team/components/DistributionSettings.tsx
git commit -m "feat(allocation): load attribute definitions dynamically from EventsService API"
```

---

## Group C: Schema Migration — Remove genderRole, Use Dynamic Attributes

### Task 8: Create Prisma migration to remove genderRole

**Files:**
- Modify: `prisma/schema.prisma:101`
- Create: Migration via `npx prisma migrate`

**Important:** This is a breaking change. Before removing the column, we need a data migration (Task 9) to copy existing values into `TeamMemberAttribute`. Run Task 9 FIRST, then Task 8.

**Pre-condition:** Task 9 (data migration script) has been run successfully.

**Step 1: Remove genderRole from schema**

In `prisma/schema.prisma`, in the `TeamMember` model, remove:
```prisma
genderRole      String
```

**Step 2: Generate and apply migration**

Run: `npx prisma migrate dev --name remove-gender-role-field`

Expected: Migration applies successfully.

**Step 3: Regenerate Prisma client**

Run: `npx prisma generate`

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "refactor(schema): remove genderRole from TeamMember, use dynamic attributes"
```

---

### Task 9: Data migration — copy genderRole to TeamMemberAttribute

**Files:**
- Create: `prisma/migrations/data-migrate-gender-role.ts`

**Context:** Before removing `genderRole` from the schema, we need to ensure every member's gender role value is preserved in the dynamic attribute system. This requires:
1. An `EventAttributeDefinition` with `name: "gender"` for each event
2. A `TeamMemberAttribute` for each member registered for that event

The seed already creates a "gender" attribute definition for the main event. But we need a migration script for any existing data.

**Step 1: Write the data migration script**

Create `prisma/migrations/data-migrate-gender-role.ts`:

```typescript
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
      console.log(`Created gender attribute definition for event: ${event.name}`);
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
    console.log(`Migrated ${migrated} gender attributes for event: ${event.name}`);
  }

  console.log("Data migration complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Step 2: Run the data migration**

Run: `npx tsx prisma/migrations/data-migrate-gender-role.ts`
Expected: Outputs migration counts, no errors.

**Step 3: Verify data**

Run: `npx prisma studio` — Check `TeamMemberAttribute` table has gender entries.

**Step 4: Commit**

```bash
git add prisma/migrations/data-migrate-gender-role.ts
git commit -m "chore(migration): data migration script to copy genderRole to dynamic attributes"
```

---

### Task 10: Update validation schema — remove genderRole

**Files:**
- Modify: `lib/validations/team-member.ts:17`

**Step 1: Remove genderRole from schema**

In `lib/validations/team-member.ts`, change:
```typescript
export const teamMemberSchema = z.object({
  alias: z.string().min(1).max(50),
  avatarId: z
    .string()
    .min(1)
    .refine((val) => !isReservedEmoji(val), {
      message: `Avatar emoji cannot be one of: ${RESERVED_EMOJIS.join(", ")} (reserved for system use)`,
    }),
  experienceLevel: z.nativeEnum(ExperienceLevel),
  genderRole: z.string().min(1),
  capabilities: z.array(z.nativeEnum(Role)).min(1),
  isActive: z.boolean().optional().default(true),
});
```
To:
```typescript
export const teamMemberSchema = z.object({
  alias: z.string().min(1).max(50),
  avatarId: z
    .string()
    .min(1)
    .refine((val) => !isReservedEmoji(val), {
      message: `Avatar emoji cannot be one of: ${RESERVED_EMOJIS.join(", ")} (reserved for system use)`,
    }),
  experienceLevel: z.nativeEnum(ExperienceLevel),
  capabilities: z.array(z.nativeEnum(Role)).min(1),
  isActive: z.boolean().optional().default(true),
});
```

**Step 2: Run tests**

Run: `npx vitest run tests/unit/ --reporter=verbose`
Expected: Some tests may need updating if they reference genderRole in fixtures.

**Step 3: Fix any broken test fixtures**

In any test that creates mock TeamMember objects with `genderRole`, remove that field.

Search: `genderRole` across `tests/` directory — update all references.

**Step 4: Commit**

```bash
git add lib/validations/team-member.ts tests/
git commit -m "refactor(validation): remove genderRole from teamMemberSchema"
```

---

### Task 11: Update CreateProfileForm — remove genderRole, rely on dynamic attributes

**Files:**
- Modify: `app/app/identity/components/CreateProfileForm.tsx`

**Context:** With genderRole removed from the schema, the form no longer sends it as a direct field. Gender is now an event-specific attribute loaded dynamically when the user selects an event. The attribute rendering code already handles SELECT types (which gender is).

**Step 1: Remove genderRole from ProfileData interface and form state**

Change interface:
```typescript
interface ProfileData {
  alias: string;
  avatarId: string;
  experienceLevel: string;
  genderRole: string;
  capabilities: string[];
  eventId?: string;
  attributes?: Record<string, any>;
}
```
To:
```typescript
interface ProfileData {
  alias: string;
  avatarId: string;
  experienceLevel: string;
  capabilities: string[];
  eventId?: string;
  attributes?: Record<string, any>;
}
```

Remove from initial state:
```typescript
const [formData, setFormData] = useState<ProfileData>({
  alias: "",
  avatarId: "😊",
  experienceLevel: "JUNIOR",
  genderRole: "unspecified",  // ← REMOVE THIS LINE
  capabilities: ["TEAM_MEMBER"],
  attributes: {},
});
```

**Step 2: Verify**

The form already renders dynamic attribute fields when an event is selected (the "Event-Specific Attributes" section). Since the "gender" EventAttributeDefinition is type SELECT with options ["FINTA", "M"], it will automatically appear as a dropdown.

Run: `npx tsc --noEmit` — no new errors.

**Step 3: Commit**

```bash
git add app/app/identity/components/CreateProfileForm.tsx
git commit -m "refactor(identity): remove genderRole from form, now handled by dynamic attributes"
```

---

### Task 12: Update algorithm validator — read gender from dynamic attributes

**Files:**
- Modify: `lib/algorithm/validator.ts:73-121`
- Modify: `lib/algorithm/types.ts` (if TeamMemberWithRelations type needs updating)
- Modify: `lib/services/assignments.service.ts` (ensure attributes are loaded)

**Context:** `validateGenderBalance` currently reads `member.genderRole` directly. After migration, gender lives in `TeamMemberAttribute` linked to an `EventAttributeDefinition(name="gender")`. The service layer should load member attributes when running the algorithm.

**Step 1: Update the validator function signature**

In `lib/algorithm/validator.ts`, change `validateGenderBalance`:

```typescript
export function validateGenderBalance(
  shiftId: string,
  assignments: Assignment[],
  members: Map<string, TeamMember>,
): ConstraintViolation | null {
```
To:
```typescript
export function validateGenderBalance(
  shiftId: string,
  assignments: Assignment[],
  members: Map<string, TeamMember>,
  memberAttributes?: Map<string, Map<string, string>>,
): ConstraintViolation | null {
```

Where `memberAttributes` is `Map<memberId, Map<attributeName, value>>`.

**Step 2: Update the gender lookup**

Change:
```typescript
assignedMembers.forEach((m) => {
  genderCounts.set(m.genderRole, (genderCounts.get(m.genderRole) || 0) + 1);
});
```
To:
```typescript
assignedMembers.forEach((m) => {
  const gender = memberAttributes?.get(m.id)?.get("gender") || "unknown";
  genderCounts.set(gender, (genderCounts.get(gender) || 0) + 1);
});
```

**Step 3: Update AssignmentsService.runAllocation to load and pass attributes**

In `lib/services/assignments.service.ts`, in the `runAllocation` method, after loading members, add attribute loading through the service layer:

```typescript
// Load member attributes for the event
const memberAttributes = new Map<string, Map<string, string>>();
for (const member of members) {
  const attrs = await this.membersService.getAttributes(member.id, eventId);
  const attrMap = new Map<string, string>();
  for (const attr of attrs) {
    attrMap.set(attr.definition.name, JSON.parse(attr.value));
  }
  memberAttributes.set(member.id, attrMap);
}
```

Then pass `memberAttributes` to `validateGenderBalance` calls.

Note: `AssignmentsService` needs access to `MembersService`. Add it via dependency injection:

```typescript
export class AssignmentsService {
  private repo: AssignmentRepository;
  private membersService: MembersService;

  constructor(repo?: AssignmentRepository, membersService?: MembersService) {
    this.repo = repo || new AssignmentRepository();
    this.membersService = membersService || new MembersService();
  }
```

**Step 4: Run tests**

Run: `npx vitest run tests/unit/ --reporter=verbose`
Fix any broken tests — update mock data to not include `genderRole`.

**Step 5: Commit**

```bash
git add lib/algorithm/validator.ts lib/services/assignments.service.ts lib/algorithm/types.ts
git commit -m "refactor(algorithm): read gender from dynamic attributes via MembersService"
```

---

### Task 13: Update seed data

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: Remove genderRole from member creation**

In `prisma/seed.ts`, remove `genderRole` from all `prisma.teamMember.create()` calls. The data looks like:

```typescript
{ alias: "Wolf", avatarId: "🐺", experienceLevel: "SENIOR", genderRole: "FINTA", ... }
```

Remove `genderRole: "FINTA"` and `genderRole: "M"` from every member object.

**Step 2: Ensure attribute definitions and member attributes are created**

The seed already has `seedEventAttributeDefinitions()` which creates "gender" and "can_drive" definitions, and `seedTeamMemberAttributes()` which creates the TeamMemberAttribute entries. Verify this section still works after the field removal.

Update `seedTeamMemberAttributes` to NOT read from `member.genderRole` anymore. Instead, use a mapping array or random assignment:

```typescript
// Define gender values for seed members
const memberGenders: Record<string, string> = {
  "Wolf": "FINTA", "Bear": "FINTA", "Eagle": "M", "Falcon": "FINTA",
  // ... map all 30 members
};
```

Or derive from the existing seed data before removing genderRole.

**Step 3: Run seed**

Run: `npx prisma migrate reset --force` (resets DB and re-seeds)
Expected: Seed completes without errors.

**Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "refactor(seed): remove genderRole, use dynamic attribute system for gender"
```

---

## Group D: Event Selection Fix

### Task 14: Fix event selection for users

**Files:**
- Modify: `app/app/identity/components/EventSelectionStep.tsx`
- Modify: `app/app/identity/page.tsx`

**Context:** The `EventSelectionStep` component receives `memberId` and when a user clicks a registered event, it calls `onEventSelected(event.id)`. The parent `page.tsx` handles this by setting localStorage and navigating. The component code looks correct on the surface — the issue may be:

1. The `GET /api/members/{id}` endpoint doesn't return `eventRegistrations` with `event` included
2. The member data fetch fails silently

**Step 1: Verify the member GET endpoint includes registrations**

Check `app/api/members/[id]/route.ts` — the GET handler should use `service.getMemberWithRelations(id)` which includes `eventRegistrations` with `event`.

If it uses `service.getMember(id)` (which only does `findById` without includes), change it to `service.getMemberWithRelations(id)`.

**Step 2: Add error feedback to EventSelectionStep**

In `fetchRegisteredEvents`, add better error handling:

```typescript
async function fetchRegisteredEvents() {
  try {
    const res = await fetch(`/api/members/${memberId}`);
    if (res.ok) {
      const data = await res.json();
      const memberData = data.data;
      const registrations = memberData?.eventRegistrations || [];
      const registeredEvents = registrations
        .filter((r: any) => r.event)
        .map((r: any) => r.event);
      setEvents(registeredEvents);

      if (registeredEvents.length === 1) {
        onEventSelected(registeredEvents[0].id);
      }
    } else {
      console.error("Failed to fetch member:", res.status);
    }
  } catch (error) {
    console.error("Failed to fetch registered events:", error);
  } finally {
    setLoading(false);
  }
}
```

**Step 3: Verify the registration endpoint works**

The `handleRegisterForEvent` calls `POST /api/events/{id}/registrations` with `{ memberId }`. Verify this endpoint is backed by `EventsService.createEventRegistration()` and works correctly.

**Step 4: Test manually**

1. Login → Identity page
2. Select an existing member → Event selection should show
3. Click a registered event → Should navigate to calendar
4. Click an available event → Should register and navigate

**Step 5: Commit**

```bash
git add app/app/identity/components/EventSelectionStep.tsx app/api/members/[id]/route.ts
git commit -m "fix(identity): ensure event selection works by loading member with relations"
```

---

## Group E: Integration Tests & Cleanup

### Task 15: Update integration tests

**Files:**
- Modify: `tests/integration.test.ts`

**Step 1: Remove genderRole from test fixtures**

Search for `genderRole` in `tests/integration.test.ts` and remove it from all TeamMember creation payloads.

**Step 2: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All tests pass (fix any remaining failures).

**Step 3: Commit**

```bash
git add tests/
git commit -m "test: update fixtures to remove genderRole after schema migration"
```

---

### Task 16: Update architecture docs

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/ARCHITECTURE-LAYERS.md`

**Step 1: Update the TeamMember description**

Remove `genderRole` from the TeamMember fields list. Add a note about the dynamic attribute system being the canonical source for member properties like gender.

**Step 2: Add a note about the migration**

In the "Known Issues" section, note that `genderRole` has been migrated to the dynamic attribute system.

**Step 3: Commit**

```bash
git add docs/
git commit -m "docs: update architecture docs to reflect genderRole migration to dynamic attributes"
```

---

## Execution Order

The tasks have dependencies. Execute in this order:

```
Group A (independent, can be parallelized):
  Task 1: Fix broken link          ─┐
  Task 2: Fix template validation   │
  Task 3: Fix capabilities          ├─ All independent
  Task 4: Fix attr.key → attr.name  │
  Task 5: Fix attribute regex       │
  Task 6: Fix algorithm preview    ─┘

Group B (depends on Group A Task 5 being done):
  Task 7: Dynamic attribute dropdowns

Group C (sequential, depends on Group A):
  Task 9:  Data migration script     ← Run FIRST
  Task 8:  Schema migration          ← Run after Task 9
  Task 10: Update validation schema  ← After schema migration
  Task 11: Update CreateProfileForm  ← After Task 10 + Task 3 + Task 4
  Task 12: Update algorithm          ← After Task 8
  Task 13: Update seed data          ← After Task 8

Group D (independent of Group C):
  Task 14: Fix event selection       ← Can run anytime

Group E (after all above):
  Task 15: Update tests
  Task 16: Update docs

Group F (final gate):
  Task 17: Full reset, seed, and smoke test
```

---

## Group F: Full Reset & Smoke Test

### Task 17: Reset database, re-seed, and verify full stack

**Files:**
- Verify: `prisma/seed.ts` (updated in Task 13)
- Verify: All API routes, UI pages

**Context:** This is the final gate. We reset the database from scratch, re-seed, run all tests, and do a manual smoke test of every fixed bug. This confirms the schema migration, seed data, and all fixes work together as a clean system.

**Step 1: Reset database and re-seed**

Run:
```bash
npx prisma migrate reset --force
```

This drops the database, re-applies all migrations (including the `remove-gender-role-field` migration), and runs `prisma/seed.ts`.

Expected: No errors. Output shows seed completed with members, events, attribute definitions, and member attributes.

**Step 2: Run full test suite**

Run:
```bash
npx vitest run --reporter=verbose
```

Expected: All tests pass. Zero failures related to `genderRole`, capabilities, or attribute schema mismatches.

**Step 3: Type check**

Run:
```bash
npx tsc --noEmit
```

Expected: No new TypeScript errors introduced by our changes.

**Step 4: Start dev server and smoke test**

Run:
```bash
npm run dev
```

Then verify each fixed bug manually:

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 1 | Create Profile | Identity → Create New Profile → fill alias, avatar, experience, select event → attributes appear → submit | 201 success, member created, attributes saved |
| 2 | Capabilities | In create form, check "Shift Lead" and "Supervisor" → submit | No 500 error, valid roles saved |
| 3 | Gender as attribute | Select event in create form → "Gender" dropdown appears with FINTA/M options | Dynamic attribute renders correctly |
| 4 | Event selection | Select existing member → registered events appear → click one | Navigates to calendar with event context |
| 5 | Event registration | Select member → click available event → "Register →" | Registers and navigates |
| 6 | Global template | Admin → Event Setup → Shift Templates → uncheck Event-Specific → fill form → save | Template created, no validation error |
| 7 | Event attribute | Admin → Event Setup → Team Attributes → create new attribute | Attribute created, no validation error |
| 8 | Calendar link | User calendar with no templates → "Create templates" link | Navigates to /admin/setup |
| 9 | Algorithm preview | Admin → Team Management → Allocation → Preview | Shows assignment count, no JSON error |
| 10 | Dynamic attributes | Admin → Team Management → Allocation → Add rule → attribute dropdown | Shows attributes from EventAttributeDefinition API |
| 11 | Attribute values | Select "gender" attribute in rule → value column | Shows FINTA/M dropdown instead of text input |

**Step 5: Commit clean state**

```bash
git add -A
git commit -m "chore: verify full stack after bugfix and dynamic attributes migration"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `npx prisma migrate reset --force` — clean reset and seed succeeds
- [ ] `npx prisma migrate status` — all migrations applied
- [ ] `npx vitest run` — all tests pass
- [ ] `npx tsc --noEmit` — no TypeScript errors
- [ ] Smoke: Create profile → works without genderRole field, dynamic attributes show
- [ ] Smoke: Event selection → clicking events works
- [ ] Smoke: Create global template → no validation error
- [ ] Smoke: Create event attribute → no validation error
- [ ] Smoke: Algorithm preview → shows results, no JSON error
- [ ] Smoke: Calendar "Create templates" link → goes to /admin/setup
- [ ] Smoke: DistributionSettings → attribute dropdown loads dynamically
- [ ] Smoke: Attribute value dropdown shows options from EventAttributeDefinition
