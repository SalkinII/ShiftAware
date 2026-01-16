# Shift Templates Design

**Status:** Planning  
**Date:** 2026-01-16  
**Planner:** @planner

---

## Context

Current shift creation is cumbersome - requires filling many fields (eventId, type, startTime, endTime, durationMinutes, priority, desirabilityScore, requiredRoles, capacity) for each shift. For complex teams with recurring shift patterns, this doesn't scale.

**Goal:** Create reusable shift templates that can be dragged onto calendar to create scheduled shifts quickly.

---

## Requirements

### Functional
- Create shift templates (name, duration, startTime, type, priority, requiredRoles, capacity, color)
- Drag-drop templates onto calendar to create scheduled shifts
- Templates are reusable across events
- Scheduled shift links template + date + eventId

### Non-Functional
- Harmonize with existing Shift model (has `isTemplate` flag already)
- Minimal schema changes
- Backward compatible (existing shifts work)
- Performance: Fast template-to-shift creation

### Constraints
- Must work with existing Event/Shift relationship
- Must preserve requiredRoles structure
- Must maintain audit trail

---

## Solution

### Schema Design

**Option A: Separate Template Model (Recommended)**
```prisma
model ShiftTemplate {
  id                String          @id @default(cuid())
  name              String
  type              ShiftType
  durationMinutes   Int
  startTime         String          // "08:00" - time only, no date
  priority          ShiftPriority   @default(CORE)
  desirabilityScore Int             @default(3)
  capacity          Int             @default(2)
  color             String?         // For UI display
  
  requiredRoles     ShiftTemplateRole[]
  scheduledShifts   ScheduledShift[]
  
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
}

model ShiftTemplateRole {
  id         String        @id @default(cuid())
  templateId String
  template   ShiftTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  role       Role
  count      Int           @default(1)
  
  @@unique([templateId, role])
}

model ScheduledShift {
  id         String        @id @default(cuid())
  templateId String
  template   ShiftTemplate @relation(fields: [templateId], references: [id])
  eventId    String
  event      Event         @relation(fields: [eventId], references: [id])
  date       DateTime      // Date only (time comes from template)
  shiftId    String?       @unique // Links to actual Shift after creation
  
  createdAt  DateTime      @default(now())
  updatedAt  DateTime       @updatedAt
  
  @@index([eventId, date])
  @@index([templateId])
}
```

**Why Option A:**
- Clean separation: templates vs scheduled vs actual shifts
- Templates reusable across events
- ScheduledShift is intermediate (template + date) before creating actual Shift
- Preserves existing Shift model unchanged

### Flow

1. **Create Template:**
   - Admin creates template with name, type, duration, startTime, requiredRoles, etc.
   - Template stored in ShiftTemplate table

2. **Drag-Drop onto Calendar:**
   - User drags template onto calendar date
   - Creates ScheduledShift (templateId + eventId + date)
   - On save, creates actual Shift:
     - startTime = date + template.startTime
     - endTime = startTime + template.durationMinutes
     - Copies all other fields from template

3. **Shift Creation:**
   - ScheduledShift → Shift conversion happens on save
   - Actual Shift created with full date/time
   - ScheduledShift.shiftId links to created Shift

---

## API Design

### GET /api/shifts/templates
Returns all templates

### POST /api/shifts/templates
Create new template
```typescript
{
  name: string
  type: ShiftType
  durationMinutes: number
  startTime: string // "08:00"
  priority: ShiftPriority
  desirabilityScore: number
  capacity: number
  color?: string
  requiredRoles: Array<{ role: Role, count: number }>
}
```

### POST /api/shifts/templates/:id/schedule
Create scheduled shift from template
```typescript
{
  eventId: string
  date: string // ISO date string
}
```
Returns ScheduledShift, optionally creates Shift immediately

### POST /api/shifts/from-scheduled/:scheduledId
Convert ScheduledShift to actual Shift
Creates Shift with calculated startTime/endTime

---

## UI Design

### Template Management Page
**Route:** `/admin/shifts/templates`
- List of templates (cards with preview)
- Create template button
- Edit/Delete template actions
- Template preview (shows time, duration, roles)

### Calendar Integration
- Template sidebar/palette (draggable templates)
- Drag onto calendar date
- Visual feedback (drop zone, preview)
- Batch create: drag multiple templates or repeat pattern

### Shift Creation Flow
1. Select template from sidebar
2. Drag onto calendar date
3. Optional: Adjust time/date before save
4. Save creates ScheduledShift → Shift

---

## Migration Strategy

1. **Add new models** (ShiftTemplate, ShiftTemplateRole, ScheduledShift)
2. **Create API endpoints** for template CRUD
3. **Build template management UI**
4. **Integrate drag-drop into calendar**
5. **Keep existing shift creation** (backward compatible)

---

## Alternatives Considered

**Option B: Use existing Shift with isTemplate=true**
- ❌ Rejected: Mixes templates with actual shifts, harder to query, doesn't scale

**Option C: Template as JSON in EventConfig**
- ❌ Rejected: Not reusable across events, harder to manage

---

## Risks & Mitigations

**Risk:** Schema migration complexity  
**Mitigation:** Additive only, no breaking changes

**Risk:** Template-to-shift conversion edge cases (timezone, DST)  
**Mitigation:** Use date-fns for date/time calculations, test thoroughly

**Risk:** Performance with many templates  
**Mitigation:** Index templateId, lazy load templates in UI

---

## Implementation Notes for @implementer

1. Start with schema migration (add 3 new models)
2. Create template API endpoints
3. Build template management page
4. Add drag-drop to calendar (use @dnd-kit - already in project)
5. Implement ScheduledShift → Shift conversion
6. Test with existing shift creation (should still work)

**Entry Point:** Start with schema migration, then template API
