# Conflict Resolution Wizard - Design Specification

**Date:** 2026-01-16  
**Agent:** @planner  
**Status:** Design Complete

---

## Context

Users need a guided workflow to resolve assignment conflicts that occur in the schedule. Currently, conflicts are detected but require manual resolution through swaps or unassignments. A wizard will guide admins through conflict resolution step-by-step.

---

## Current State Analysis

### Existing Infrastructure ✅
- Conflict detection in `lib/algorithm/validator.ts`:
  - `SHIFT_OVERLAP` - Time conflicts (member assigned to overlapping shifts)
  - `SHIFT_CAPACITY` - Capacity violations (shift over capacity)
  - `GENDER_BALANCE` - Gender imbalance (hard constraint violation)
  - `MINIMUM_SHIFTS` - Insufficient assignments (member below minimum)
- Coverage dashboard (`/admin/coverage`) shows gaps and conflicts
- Swap interface exists for manual swaps
- Assignment algorithm detects conflicts during run
- Validator functions return `ConstraintViolation` objects

### What's Missing ❌
- Conflict detection API endpoint (scan current assignments)
- Conflict resolution wizard UI component
- Guided workflow for resolving each conflict type
- Suggestions for resolution actions
- Integration with coverage dashboard and assignments page

---

## Requirements

### Functional
- Detect all conflicts in current schedule
- Display conflicts grouped by type
- Guide user through resolution step-by-step
- Suggest resolution actions (swaps, unassignments, new assignments)
- Apply resolutions and validate results
- Show progress and remaining conflicts

### Non-Functional
- Simple, guided workflow (not complex automation)
- Reuse existing UI components
- Clear visual feedback
- Atomic operations (transaction-based)
- Cache invalidation after resolution

### Constraints
- Must maintain data integrity
- Cannot violate hard constraints (overlaps, capacity)
- Must audit all resolution actions
- Should integrate with existing swap/unassign flows

---

## Solution Design

### 1. Conflict Detection API

**Endpoint:** `GET /api/conflicts`

**Response:**
```typescript
{
  conflicts: Conflict[];
  summary: {
    total: number;
    byType: Record<ConflictType, number>;
    bySeverity: Record<"hard" | "soft", number>;
  };
}

interface Conflict {
  id: string;
  type: ConflictType;
  severity: "hard" | "soft";
  message: string;
  affectedEntities: {
    shifts?: string[];
    members?: string[];
    assignments?: string[];
  };
  suggestions: ResolutionSuggestion[];
}

type ConflictType = 
  | "SHIFT_OVERLAP"
  | "SHIFT_CAPACITY" 
  | "GENDER_BALANCE"
  | "MINIMUM_SHIFTS";

interface ResolutionSuggestion {
  action: "SWAP" | "UNASSIGN" | "ASSIGN" | "REASSIGN";
  description: string;
  affectedAssignments?: string[];
  targetMember?: string;
  targetShift?: string;
  confidence: number; // 0-1, how likely this resolves the conflict
}
```

**Logic:**
- Fetch all assignments with shifts and members
- Run validator functions on each assignment
- Group conflicts by type
- Generate resolution suggestions
- Return sorted by severity (hard first)

### 2. Conflict Resolution Wizard UI

**Location:** `/admin/conflicts` (new page) or modal from coverage dashboard

**Components:**
- `ConflictWizard` - Main wizard component
- `ConflictList` - List of conflicts with severity indicators
- `ConflictDetail` - Details of selected conflict
- `ResolutionSuggestions` - Suggested actions
- `ResolutionPreview` - Preview of changes before applying

**Wizard Flow:**
1. **Scan** - Detect all conflicts
2. **Select** - Choose conflict to resolve
3. **Review** - See conflict details and suggestions
4. **Resolve** - Choose resolution action
5. **Confirm** - Preview changes and confirm
6. **Apply** - Execute resolution
7. **Validate** - Check if conflict resolved, show next conflict

### 3. Resolution Strategies by Conflict Type

**SHIFT_OVERLAP:**
- **Suggestion 1:** Unassign member from one of the overlapping shifts
- **Suggestion 2:** Swap member with someone not in conflict
- **Suggestion 3:** Find alternative shift for member

**SHIFT_CAPACITY:**
- **Suggestion 1:** Unassign excess members (lowest priority first)
- **Suggestion 2:** Move members to under-capacity shifts
- **Suggestion 3:** Increase shift capacity (if allowed)

**GENDER_BALANCE:**
- **Suggestion 1:** Swap members to balance genders
- **Suggestion 2:** Assign additional member of underrepresented gender
- **Suggestion 3:** Unassign member causing imbalance

**MINIMUM_SHIFTS:**
- **Suggestion 1:** Assign member to additional core shift
- **Suggestion 2:** Reassign from non-core to core shift
- **Suggestion 3:** Find available shifts matching preferences

### 4. Resolution API Endpoints

**Apply Resolution:** `POST /api/conflicts/resolve`
```typescript
{
  conflictId: string;
  resolution: {
    action: "SWAP" | "UNASSIGN" | "ASSIGN" | "REASSIGN";
    assignmentIds?: string[];
    memberId?: string;
    shiftId?: string;
    targetMemberId?: string;
    targetShiftId?: string;
  };
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
  resolved: boolean; // Whether conflict was actually resolved
  newConflicts?: Conflict[]; // Conflicts created by this resolution
}
```

### 5. Integration Points

**Coverage Dashboard:**
- Add "Resolve Conflicts" button
- Show conflict count badge
- Link to conflict wizard

**Assignments Page:**
- Show conflict indicators on conflicted assignments
- Quick action to resolve specific conflict

**Conflict Wizard Page:**
- Standalone page at `/admin/conflicts`
- Can be opened from coverage dashboard or directly

---

## Implementation Plan

### Phase 1: Conflict Detection API
1. Create `GET /api/conflicts` endpoint
2. Implement conflict scanning logic
3. Generate resolution suggestions
4. Return structured conflict data

### Phase 2: Wizard UI Components
1. Create `ConflictWizard` component
2. Create `ConflictList` component
3. Create `ResolutionSuggestions` component
4. Create `ResolutionPreview` component

### Phase 3: Resolution API
1. Create `POST /api/conflicts/resolve` endpoint
2. Implement resolution actions (swap, unassign, assign)
3. Validate resolution doesn't create new conflicts
4. Create audit log entries

### Phase 4: Integration
1. Add conflict wizard link to coverage dashboard
2. Add conflict indicators to assignments page
3. Add conflict count badges
4. Test end-to-end workflow

---

## Success Criteria

- [ ] Users can detect all conflicts in schedule
- [ ] Conflicts are grouped by type and severity
- [ ] Resolution suggestions are provided for each conflict
- [ ] Users can apply resolutions through guided workflow
- [ ] Resolutions are atomic and audited
- [ ] New conflicts created by resolution are detected
- [ ] UI integrates with existing pages

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Resolution creates new conflicts | Validate before applying, show preview |
| Too many conflicts overwhelm UI | Paginate, filter by type/severity |
| Suggestions not helpful | Start with simple cases, improve iteratively |
| Performance with many conflicts | Cache conflict scan, incremental updates |

---

## Implementation Notes for @implementer

1. **Start simple:**
   - Focus on SHIFT_OVERLAP conflicts first (most common)
   - Simple suggestions: unassign or swap
   - Then add other conflict types

2. **Reuse existing:**
   - Use SwapInterface patterns for swap actions
   - Use ConfirmDialog for confirmations
   - Use existing validator functions

3. **Performance:**
   - Cache conflict scan results
   - Only rescan after resolution applied
   - Lazy load suggestions

4. **UX:**
   - Clear progress indicator
   - Show remaining conflicts count
   - Allow skipping conflicts
   - Batch resolution option (future)

---

## Alternatives Considered

### 1. Automatic Conflict Resolution
**Rejected:** Too risky, users need control over assignments

### 2. Conflict Prevention Only
**Rejected:** Conflicts will occur, need resolution workflow

### 3. Simple List View
**Rejected:** Wizard provides better guidance and reduces errors

---

## Next Steps

Delegate to @implementer to:
1. Create conflict detection API endpoint
2. Implement conflict scanning logic
3. Build wizard UI components
4. Add resolution API endpoint
5. Integrate with existing pages
