# Action Rollback - Design Specification

**Date:** 2026-01-16  
**Agent:** @planner → @implementer  
**Status:** ✅ Implementation Complete

---

## Context

User wants to implement action rollback functionality to allow undoing recent changes. This is a high-value feature that improves user confidence and reduces impact of mistakes.

---

## Current State Analysis

### Existing Infrastructure ✅
- Audit log system with `before` and `after` JSON snapshots
- Audit actions: CREATE, UPDATE, DELETE, PREFERENCE_SUBMIT, ASSIGNMENT_RUN, MANUAL_SWAP, EXPORT
- Audit log viewer page (`/admin/audit`)
- All mutations create audit log entries

### What's Missing ❌
- Rollback API endpoint
- Rollback UI (button/action in audit log viewer)
- Rollback logic for different entity types
- Confirmation dialog for rollback
- Cache invalidation after rollback

---

## Requirements

### Functional
- Undo recent changes (CREATE, UPDATE, DELETE operations)
- Support rollback for: Shifts, Members, Assignments, Preferences
- Show what will be rolled back (preview)
- Confirmation before rollback
- Show rollback result (success/error)

### Non-Functional
- Safe rollback (validate before applying)
- Atomic operations (transaction-based)
- Audit rollback actions themselves
- Clear error messages if rollback fails
- Cache invalidation after successful rollback

### Constraints
- Only rollback recent changes (configurable limit, e.g., last 100 actions)
- Cannot rollback EXPORT actions (no-op)
- Cannot rollback ASSIGNMENT_RUN if subsequent changes exist
- Must maintain audit trail integrity

---

## Solution Design

### 1. Rollback API Endpoint

**Endpoint:** `POST /api/audit/rollback`

**Request:**
```typescript
{
  auditLogId: string; // ID of audit log entry to rollback
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
  rolledBackAction: AuditAction;
  entityType: EntityType;
  entityId: string;
}
```

**Logic:**
- Fetch audit log entry
- Validate rollback is possible (check for subsequent changes)
- Determine rollback operation based on action:
  - CREATE → DELETE
  - UPDATE → UPDATE (restore `before` state)
  - DELETE → CREATE (restore `before` state)
- Execute rollback in transaction
- Create new audit log entry for rollback action
- Return success/error

### 2. Rollback UI

**Location:** `/admin/audit` page

**Components:**
- Rollback button per audit log entry (if rollbackable)
- Confirmation dialog (reuse ConfirmDialog component)
- Preview of what will be rolled back
- Toast notification for success/error

**Rollbackable Actions:**
- CREATE (can delete)
- UPDATE (can restore previous state)
- DELETE (can recreate)
- MANUAL_SWAP (can reverse swap)

**Non-Rollbackable:**
- EXPORT (no-op, nothing to undo)
- ASSIGNMENT_RUN (too complex, may have subsequent changes)

### 3. Rollback Logic by Entity Type

**Shifts:**
- CREATE → Delete shift (with related records)
- UPDATE → Restore shift fields from `before`
- DELETE → Recreate shift from `before` (with related records)

**Members:**
- CREATE → Soft delete (set isActive=false)
- UPDATE → Restore member fields from `before`
- DELETE → Restore isActive=true (soft delete reversal)

**Assignments:**
- CREATE → Delete assignment
- UPDATE → Restore assignment fields from `before`
- DELETE → Recreate assignment from `before`
- MANUAL_SWAP → Reverse swap (swap back)

**Preferences:**
- CREATE → Delete preference
- UPDATE → Restore preference from `before`
- DELETE → Recreate preference from `before`

### 4. Validation & Safety

**Pre-Rollback Checks:**
- Verify audit log entry exists
- Check if entity still exists (for UPDATE/DELETE rollback)
- Check for subsequent changes (warn if exists)
- Validate `before`/`after` data is valid JSON

**Transaction Safety:**
- Wrap rollback in database transaction
- Rollback transaction on error
- Create audit log entry for rollback action

---

## Implementation Plan

### Phase 1: API Endpoint
1. Create `POST /api/audit/rollback` endpoint
2. Implement rollback logic for each entity type
3. Add validation and error handling
4. Create audit log entry for rollback

### Phase 2: UI Integration
1. Add rollback button to audit log entries
2. Add confirmation dialog with preview
3. Call rollback API endpoint
4. Handle success/error with toast notifications
5. Invalidate cache after successful rollback

### Phase 3: Edge Cases
1. Handle cascading rollbacks (e.g., shift delete → restore assignments)
2. Handle conflicts (entity modified since audit log)
3. Handle missing data (entity deleted, audit log stale)

---

## Success Criteria

- [x] Users can rollback CREATE, UPDATE, DELETE operations
- [x] Rollback is atomic (all-or-nothing) - implemented using Prisma transactions
- [x] Rollback actions are audited - new audit log entry created for each rollback
- [x] Clear error messages for failed rollbacks - error handling with toast notifications
- [x] Cache invalidates after rollback - cache invalidation event dispatched
- [x] UI shows rollback status and results - confirmation dialog, toast notifications, audit log refresh

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Data inconsistency | Use transactions, validate before rollback |
| Cascading effects | Document and handle explicitly |
| Stale audit logs | Check entity existence, warn on conflicts |
| Complex rollbacks | Start with simple cases, defer complex ones |

---

## Implementation Notes for @implementer

1. **Start with simple cases:**
   - Member CREATE/DELETE rollback
   - Shift CREATE/DELETE rollback
   - Then handle UPDATE cases

2. **Use transactions:**
   - Wrap rollback operations in Prisma transactions
   - Ensure atomicity

3. **Handle edge cases:**
   - Entity doesn't exist
   - Entity was modified since audit log
   - Missing `before`/`after` data

4. **Test thoroughly:**
   - Test each entity type
   - Test with subsequent changes
   - Test error cases

---

## Alternatives Considered

### 1. Full History Replay
**Rejected:** Too complex, requires replaying all actions in order

### 2. Snapshot-Based Rollback
**Rejected:** Would require storing full snapshots, too much storage

### 3. Time-Based Rollback
**Rejected:** Less precise, harder to implement

---

## Next Steps

Delegate to @implementer to:
1. Create rollback API endpoint
2. Implement rollback logic for each entity type
3. Add rollback UI to audit log page
4. Test and iterate
