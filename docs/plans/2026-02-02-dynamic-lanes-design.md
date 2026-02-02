# Dynamic Lanes & Data Cleanup Design

**Date:** 2026-02-02  
**Status:** Approved  
**Goal:** Replace hardcoded lane configuration with dynamic lanes derived from ShiftTemplate data. Clean up stale data and align enums.

---

## 1. Problem Statement

### Current Issues
1. **Hardcoded lanes** in `lib/types/lane.ts` with fixed `LANE_CONFIG`
2. **Enum mismatches** between schema and code:
   - Schema: `MOBILE_TEAM`, `STATIONARY`, `SHIFT_LEAD`, `SUPER`, `BUFFER`, `EXTENDED`
   - Code uses: `MOBILE_TEAM_1`, `MOBILE_TEAM_2`, `EXECUTIVE` (invalid)
3. **Stale data** in database showing old festivals in dropdowns
4. **Missing link** between Shift and ShiftTemplate for lane mapping

### Desired State
- Lanes derived dynamically from ShiftTemplate names
- Each template = one lane in calendar
- Clean database with only current event data
- All code using valid schema enum values

---

## 2. Architecture Decision

### Lanes Are Data, Not Config

**Before:**
```
lib/types/lane.ts → LANE_CONFIG (hardcoded) → LaneCalendarView
```

**After:**
```
ShiftTemplate (DB) → GET /api/events/[id]/templates → deriveLanesFromTemplates() → LaneCalendarView
```

### Key Principles
- Template name defines the lane label
- Template color defines the lane color  
- Template laneOrder defines vertical position
- ShiftType is for categorization/filtering, not lane identity

---

## 3. Schema Changes

### Add `laneOrder` to ShiftTemplate

```prisma
model ShiftTemplate {
  // existing fields...
  laneOrder Int @default(0)  // NEW: vertical position in calendar
}
```

### Add `templateId` to Shift

```prisma
model Shift {
  // existing fields...
  
  // NEW: Direct link to template for lane mapping
  templateId String?
  template   ShiftTemplate? @relation("ShiftFromTemplate", fields: [templateId], references: [id])
}

model ShiftTemplate {
  // existing fields...
  shifts Shift[] @relation("ShiftFromTemplate")  // NEW
}
```

### Remove `allowedLanes` from ShiftTemplate

The `allowedLanes ShiftType[]` field is no longer needed since lanes are dynamic.

---

## 4. Enum Alignment

### ShiftType (Schema - Source of Truth)
```prisma
enum ShiftType {  
  MOBILE_TEAM
  STATIONARY
  SHIFT_LEAD
  SUPER
  BUFFER
  EXTENDED
}
```

### Role (Schema - Source of Truth)
```prisma
enum Role {
  TEAM_MEMBER
  SHIFT_LEAD
  SUPER
}
```

### Migration Mapping
| Old (invalid) | New (valid) |
|---------------|-------------|
| `MOBILE_TEAM_1` | `MOBILE_TEAM` |
| `MOBILE_TEAM_2` | `MOBILE_TEAM` |
| `EXECUTIVE` | `SUPER` |
| `Role.EXECUTIVE` | `Role.SUPER` |

---

## 5. Data Model

### Lane Interface (TypeScript)
```typescript
export interface Lane {
  id: string;           // template ID
  name: string;         // template name (displayed as lane label)
  type: string;         // ShiftType for filtering
  color: string;        // hex color for lane
  order: number;        // laneOrder for vertical position
}
```

### Derive Function
```typescript
export function deriveLanesFromTemplates(templates: ShiftTemplate[]): Lane[] {
  return templates
    .map(t => ({
      id: t.id,
      name: t.name,
      type: t.type,
      color: t.color || '#6b7280',
      order: t.laneOrder || 0,
    }))
    .sort((a, b) => a.order - b.order);
}
```

---

## 6. API Changes

### GET /api/shifts
Add `template` to include:
```typescript
const shifts = await prisma.shift.findMany({
  include: {
    template: true,  // NEW
    event: true,
    requiredRoles: true,
    assignments: { ... },
  },
});
```

### GET /api/shifts/templates
Order by `laneOrder`:
```typescript
orderBy: { laneOrder: 'asc' }
```

### POST /api/shifts
Accept optional `templateId`:
```typescript
const validated = shiftSchema.parse(body);
// templateId now allowed in schema
```

---

## 7. UI Component Changes

### lib/types/lane.ts
- Remove `LANE_CONFIG` constant
- Remove `LANES_ORDERED` constant
- Keep `getLaneColor()` and `getLaneLabel()` but accept lanes array as parameter
- Add `deriveLanesFromTemplates()` function

### LaneCalendarView.tsx
```typescript
interface LaneCalendarViewProps {
  shifts: Shift[];
  lanes: Lane[];  // NEW: passed in, not imported
  onShiftCreate?: (shift: ShiftData) => void;
  // ... other props
}
```

### Admin Schedule Page
```typescript
// Fetch templates for event
const templatesRes = await fetch(`/api/events/${eventId}/templates`);
const { assigned, eventSpecific } = await templatesRes.json();
const allTemplates = [...assigned, ...eventSpecific];
const lanes = deriveLanesFromTemplates(allTemplates);

// Pass to calendar
<LaneCalendarView shifts={shifts} lanes={lanes} />
```

---

## 8. Seed Data Structure

### Single Test Event
```typescript
const EVENT = {
  id: "event_starlight_2026",
  name: "Starlight Meadow Festival 2026",
  startDate: "2026-06-26",
  endDate: "2026-06-29",
};
```

### Templates Define Lanes
```typescript
const TEMPLATES = [
  { name: "Mobile North", type: ShiftType.MOBILE_TEAM, color: "#0ea5e9", laneOrder: 1 },
  { name: "Mobile South", type: ShiftType.MOBILE_TEAM, color: "#8b5cf6", laneOrder: 2 },
  { name: "Info Tent", type: ShiftType.STATIONARY, color: "#22c55e", laneOrder: 3 },
  { name: "Coordination", type: ShiftType.SUPER, color: "#f59e0b", laneOrder: 4 },
];
```

### Members Use Valid Roles
```typescript
{ alias: "Wolf", capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD, Role.SUPER] },
{ alias: "Bear", capabilities: [Role.TEAM_MEMBER, Role.SHIFT_LEAD] },
// etc.
```

---

## 9. Database Reset

Full reset required to clear stale data:
```bash
npx prisma migrate reset --force
```

This will:
1. Drop all tables
2. Re-run all migrations
3. Run updated seed script

---

## 10. Files to Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `laneOrder` to ShiftTemplate, add `templateId` to Shift, remove `allowedLanes` |
| `prisma/seed.ts` | Fix enums, create templates with laneOrder, link shifts to templates |
| `lib/types/lane.ts` | Remove hardcoded config, add derive function |
| `lib/validations/template.ts` | Add `laneOrder` field |
| `lib/validations/shift.ts` | Add optional `templateId` field |
| `app/api/shifts/route.ts` | Include `template` in GET response |
| `app/api/shifts/templates/route.ts` | Order by `laneOrder` |
| `components/features/LaneCalendar/LaneCalendarView.tsx` | Accept `lanes` as prop |
| `app/admin/shifts/schedule/page.tsx` | Derive lanes from templates |
| `tests/lane-validation.test.ts` | Update to valid ShiftType values |
| `tests/lane.test.ts` | Update to valid ShiftType values |

---

## 11. Success Criteria

1. Calendar renders lanes dynamically from template data
2. No hardcoded `LANE_CONFIG` anywhere in codebase
3. All ShiftType and Role values match Prisma schema
4. Database contains only seeded test event (no stale data)
5. Dropdowns show only current event
6. Shifts display in correct lane based on their template

---

## 12. References

- UI Data Flow: `docs/plans/2026-02-01-ui-data-flow-mapping.md`
- v2.1 Design: `docs/plans/2026-02-01-shiftaware-v21-complete-design.md`
