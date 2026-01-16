# UI Improvements Plan

**Status:** Planning  
**Date:** 2026-01-16  
**Planner:** @planner

---

## Context

User provided two context files:
1. **UI Restructure Spec** - Major UI/UX improvements and new features
2. **Login UI Review** - Content audit and branding updates

**Goal:** Harmonize improvements with existing codebase, be critical about additions, finish UI first, then implement improvements.

---

## Analysis: Existing vs Requested

### ✅ Already Exists
- Event model (Event, EventConfig) - matches "Festival Configuration"
- Shift model - exists but different structure (no templates)
- Calendar view - exists but needs scroll behavior improvements
- Team management - exists (TeamMember model)
- Algorithm display - exists but needs transparency improvements
- Swap interface - exists but needs UI improvements
- Admin routes - exists (`/admin/*`)

### ❌ Missing / Needs Changes
1. **Shift Templates** - New concept, requires schema changes
2. **Route restructuring** - `/app/*` for users (currently all `/dashboard/*`)
3. **Calendar scroll behavior** - Sticky headers, scroll to festival start
4. **Bulk team add** - Not implemented
5. **Extensible attributes** - MemberAttribute model missing
6. **Content/config** - Hardcoded strings, no site config
7. **Avatar consistency** - Need to audit and standardize

---

## Critical Assessment

### 🚨 Major Changes (Requires Careful Planning)
1. **Shift Templates** - Significant schema change, affects shift creation flow
2. **Route Restructure** - `/app/*` vs `/admin/*` - affects all routes
3. **Calendar Scroll** - Core UX change, needs testing

### ⚠️ Medium Changes (Can Harmonize)
1. **Bulk team add** - Feature addition, doesn't break existing
2. **Extensible attributes** - Optional enhancement
3. **Content/config** - Refactoring, low risk
4. **Avatar consistency** - Audit and fix

### ✅ Low Risk (Polish)
1. **UI Rules** - Spacing, borders, tiles - aligns with Design System v2
2. **Login UI Review** - Content updates, config extraction

---

## Harmonization Strategy

### Phase 1: Finish UI Foundation ✅
**Status:** In Progress
- Complete Design System v2 components (Input, Card, Navigation)
- Document UI paradigm
- **Do NOT start improvements until this is done**

### Phase 2: Low-Risk Improvements
**Priority:** High
1. **Content/Config Extraction** (260116_login_UI_REVIEW.md)
   - Create `config/site.ts` for festival name, branding
   - Extract hardcoded strings
   - Update logo paths
   - **Risk:** Low, refactoring only

2. **Avatar Consistency Audit**
   - Find all UserIcon/PersonIcon usage
   - Replace with EmojiAvatar
   - **Risk:** Low, visual only

3. **UI Rules Implementation** (Global UI Rules from spec)
   - Spacing: p-4 containers, p-3 cards, gap-2 to gap-4
   - Borders: Use divide-y, bg-muted, ring-1 instead of explicit borders
   - Tiles: Compact design with bg-primary/10
   - **Risk:** Low, aligns with Design System v2

### Phase 3: Medium-Risk Features
**Priority:** Medium (After Phase 2)
1. **Bulk Team Add**
   - Add "Add X members" button
   - Create placeholders with random emoji avatars
   - **Risk:** Medium - new feature but isolated

2. **Extensible Attributes** (Optional)
   - Add MemberAttribute model if needed
   - **Risk:** Medium - schema change but optional

### Phase 4: Major Changes (Requires Detailed Planning)
**Priority:** Low (Evaluate necessity)
1. **Shift Templates**
   - **Critical Question:** Is this necessary? Current shift creation works.
   - **Impact:** Major schema change, affects shift creation flow
   - **Recommendation:** Defer unless user explicitly needs templates

2. **Route Restructure** (`/app/*` vs `/admin/*`)
   - **Critical Question:** Is current `/dashboard/*` structure insufficient?
   - **Impact:** All routes need restructuring, middleware changes
   - **Recommendation:** Evaluate if current structure works, defer if not critical

3. **Calendar Scroll Behavior**
   - **Critical Question:** Does current calendar have scroll issues?
   - **Impact:** Core UX change, needs extensive testing
   - **Recommendation:** Implement if user reports issues, otherwise defer

---

## Recommended Implementation Order

### Immediate (Finish UI)
1. ✅ Complete Design System v2 (Input, Card, Navigation)
2. ✅ Document UI paradigm

### Next (Low-Risk)
3. Content/config extraction
4. Avatar consistency audit
5. UI rules implementation (spacing, borders, tiles)

### Later (Evaluate Necessity)
6. Bulk team add (if needed)
7. Calendar scroll improvements (if current has issues)
8. Route restructure (if current structure insufficient)
9. Shift templates (if templates are actually needed)

---

## User Clarifications ✅

1. **Shift Templates:** ✅ TOTALLY NEEDED - Current shift creation is cumbersome, doesn't scale
2. **Route Restructure:** ✅ Do what works best with current architecture, ensure separate UI flows for Team Members vs Admins
3. **Calendar Scroll:** 
   - Horizontal: OK but not pretty, inspired by INFINITE_SCROLL.md
   - Vertical: Use infinite scroll approach
   - Fit well into existing, no overengineering
4. **Priority:** 
   - Top: Shift creation (templates)
   - Important: Swap interface (condensed calendar/grid view)
5. **Approach:** Option A - Finish UI first, then improvements

---

## Updated Implementation Order

### Phase 1: Finish UI Foundation ✅ (Current)
1. Complete Design System v2 (Input, Card, Navigation)
2. Document UI paradigm

### Phase 2: High Priority Improvements
1. **Shift Templates** (Top Priority)
   - Design template system
   - Implement drag-drop templates onto calendar
   - Save as scheduled shifts
   - **Impact:** Major UX improvement, scales for complex teams

2. **Swap Interface** (Condensed Calendar/Grid)
   - Improve swap UI with condensed view
   - Grid/calendar layout for better overview
   - **Impact:** Critical user workflow

3. **Calendar Scroll Improvements**
   - Vertical: Infinite scroll (from INFINITE_SCROLL.md)
   - Horizontal: Inspired by INFINITE_SCROLL.md, fit into existing
   - Sticky headers, scroll to festival start
   - **Impact:** Better UX, no overengineering

### Phase 3: Medium Priority
4. Content/config extraction
5. Avatar consistency audit
6. UI rules implementation
7. Route separation (Team Members vs Admins UI flows)

### Phase 4: Lower Priority
8. Bulk team add
9. Extensible attributes (if needed)

---

## Next Steps

1. **@implementer** - Finish Design System v2 components (Input, Card, Navigation)
2. **@planner** - Design Shift Templates system harmonized with existing schema
3. **@planner** - Design Calendar scroll improvements (vertical infinite, horizontal inspired)
4. **@implementer** - Implement Shift Templates (top priority)
5. **@implementer** - Improve Swap Interface (condensed view)
