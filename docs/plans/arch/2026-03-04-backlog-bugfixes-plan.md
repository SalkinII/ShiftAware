# Backlog Bugfixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Resolve all items from `docs/BugsAndBacklog.txt` — capacity bug, stale field displays, sidebar profile card, and resize error.

**Architecture:** Fix JS falsy-coercion bugs (`||` → `??`), hide deprecated UI fields while preserving API/schema compatibility, enrich sidebar profile card data flow by passing full `teamMember` objects from API responses, and clean up stale `experienceLevel`/`capabilities` displays across admin pages.

**Tech Stack:** Next.js 15, React 19, Zod, Prisma, Tailwind CSS.

---

### Task 1: Fix Capacity 0→2 Bug

**Root Cause:** JavaScript's `||` operator treats `0` as falsy. Every place that does `template.capacity || 2` silently converts a 0-capacity template into a 2-capacity shift. The Prisma schema also defaults to 2.

**Status:** ALREADY APPLIED in previous session. Verify only.

**Files (already modified):**
- `components/features/LaneCalendar/hooks/useCanvasActions.ts:101,103` — `|| 2` → `?? 0`
- `components/features/ModifySlotDialog/ModifySlotDialog.tsx:47,63,201,204` — `|| 2` → `?? 0`, min 0
- `app/admin/setup/components/TemplateManager.tsx:44,146` — default `capacity: 0`
- `prisma/schema.prisma` — `Shift.capacity @default(0)`, `ShiftTemplate.capacity @default(0)`

**Step 1: Verify changes**
Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new type errors from capacity changes.

**Step 2: Generate Prisma migration**
Run: `npx prisma migrate dev --name capacity-default-zero`
Expected: Migration created, applied to dev DB.

**Step 3: Commit**
```bash
git add lib/validations/ components/features/LaneCalendar/hooks/useCanvasActions.ts \
  components/features/ModifySlotDialog/ModifySlotDialog.tsx \
  app/admin/setup/components/TemplateManager.tsx \
  prisma/schema.prisma prisma/migrations/
git commit -m "fix: capacity 0 no longer coerced to 2 (|| → ??)"
```

---

### Task 2: Hide Shift Type & Priority from TemplateManager UI

**Root Cause:** `TemplateManager.tsx` still renders "Shift Type" (Mobile/Stationary/Super) and "Priority" (Core/Buffer) selects in the form, plus priority badges in template list items. These fields are deprecated in the UI but must remain in the schema/API.

**Status:** ALREADY APPLIED in previous session. Verify only.

**Files (already modified):**
- `app/admin/setup/components/TemplateManager.tsx` — removed Shift Type + Priority selects from form, removed priority badges from both global and event-specific template lists, removed unused `Select` import.

**Step 1: Verify template form**
Open admin setup page → click "New Template" → confirm only Name, Start Time, Duration, Capacity fields are visible. No Shift Type or Priority.

**Step 2: Verify template list**
Confirm template list items show name, time, capacity — no priority badge.

**Step 3: Commit**
```bash
git add app/admin/setup/components/TemplateManager.tsx
git commit -m "style: hide deprecated Shift Type and Priority from template UI"
```

---

### Task 3: Remove Stale experienceLevel Displays

**Root Cause:** `experienceLevel` (Junior/Intermediate/Senior) is shown in two admin team pages but serves no functional purpose. The user wants it removed from all UI.

**Files:**
- Modify: `app/admin/team/manage/page.tsx` — lines 419-428 (experienceLevel badge), lines 284-294 (`getExpBadgeColor` function), lines 527-537 ("Senior Staff" stat)
- Modify: `app/admin/team/components/MemberListByEvent.tsx` — lines 303-305 (experienceLevel under alias), lines 349-351 (experienceLevel in add-member picker)

**Step 1: Edit `manage/page.tsx` — remove experienceLevel badge from member cards**
Find the badge rendering inside each member card:
```tsx
<div className="flex items-center gap-2 mt-1">
  <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded", getExpBadgeColor(member.experienceLevel))}>
    {member.experienceLevel}
  </span>
</div>
```
Remove this entire `<div>` block.

**Step 2: Edit `manage/page.tsx` — remove `getExpBadgeColor` function**
Remove the `getExpBadgeColor` function (lines ~284-294) since nothing uses it anymore.

**Step 3: Edit `manage/page.tsx` — remove "Senior Staff" stat from sidebar**
Find and remove the "Senior Staff" stat card that filters by `experienceLevel === "SENIOR"`.

**Step 4: Edit `MemberListByEvent.tsx` — remove experienceLevel under member alias**
In the registered members list, remove:
```tsx
<div className="text-sm text-gray-500">
  {member.experienceLevel}
</div>
```

**Step 5: Edit `MemberListByEvent.tsx` — remove experienceLevel from add-member picker**
In the unregistered members picker modal, remove:
```tsx
<div className="text-xs text-gray-500">
  {member.experienceLevel}
</div>
```

**Step 6: Run linter**
Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors.

**Step 7: Commit**
```bash
git add app/admin/team/manage/page.tsx app/admin/team/components/MemberListByEvent.tsx
git commit -m "style: remove stale experienceLevel displays from admin team pages"
```

---

### Task 4: Remove Capabilities Display from manage/page.tsx

**Root Cause:** The admin team manage page shows a "Capabilities" section with role badges (TEAM_MEMBER, ADMIN) on each member card. The user says roles should be determined by password, not displayed/edited as checkboxes.

**Files:**
- Modify: `app/admin/team/manage/page.tsx` — lines 460-475 (capabilities badges section)

**Step 1: Remove capabilities section from member cards**
Find and remove:
```tsx
<div className="mt-6 pt-4 border-t border-gray-50">
  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
    <Shield className="w-3 h-3 text-primary-400" /> Capabilities
  </p>
  <div className="flex flex-wrap gap-1.5">
    {member.capabilities.map((cap) => (
      <span key={cap} className="text-[10px] font-bold bg-gray-50 text-gray-600 px-2 py-1 rounded-lg border border-gray-100">
        {cap.replace("_", " ")}
      </span>
    ))}
  </div>
</div>
```

**Step 2: Remove unused `Shield` import if no longer referenced**
Check if `Shield` is used elsewhere in the file. If not, remove from import.

**Step 3: Run linter**
Run: `npx tsc --noEmit 2>&1 | head -30`

**Step 4: Commit**
```bash
git add app/admin/team/manage/page.tsx
git commit -m "style: remove capabilities badges from team manage page"
```

---

### Task 5: Fix Sidebar Profile Card — Pass Full Member Data

**Root Cause:** `ShiftPropertiesPanel.tsx` only passes `{ alias, avatarId }` to `ProfileDetailCard` when a user clicks an assignment's avatar. The API (`GET /api/shifts/:id`) returns full `teamMember` objects via `assignments[].teamMember` (includes `id`, `alias`, `avatarId`, `experienceLevel`, `capabilities`, `isActive`, `isAdmin`). The card receives incomplete data and renders bare-bones.

**Files:**
- Modify: `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx`

**Step 1: Update `profileCardMember` state type**
Change the state type from `{ alias: string; avatarId?: string }` to include all fields `ProfileDetailCard` can display:
```tsx
const [profileCardMember, setProfileCardMember] = useState<{
  id?: string;
  alias: string;
  avatarId?: string;
  attributes?: { name: string; value: string }[];
} | null>(null);
```

**Step 2: Pass full teamMember data on avatar click**
Change the `onClick` handler from:
```tsx
setProfileCardMember({
  alias: assignment.teamMember?.alias || "Unknown",
  avatarId: assignment.teamMember?.avatarId,
})
```
To:
```tsx
setProfileCardMember({
  id: assignment.teamMember?.id,
  alias: assignment.teamMember?.alias || "Unknown",
  avatarId: assignment.teamMember?.avatarId,
})
```

**Step 3: Run linter**
Run: `npx tsc --noEmit 2>&1 | head -30`

**Step 4: Commit**
```bash
git add components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx
git commit -m "fix: pass full member data to sidebar ProfileDetailCard"
```

---

### Task 6: Clean Up ProfileDetailCard Save Handler

**Root Cause:** `ProfileDetailCard.tsx` `handleSave` sends `experienceLevel` and `capabilities` to the API even though these fields are no longer user-facing. This creates coupling to deprecated fields.

**Files:**
- Modify: `components/features/Identity/ProfileDetailCard.tsx`

**Step 1: Remove deprecated fields from save payload**
In `handleSave`, change:
```tsx
body: JSON.stringify({
  id: draft.id,
  alias: draft.alias,
  avatarId: draft.avatarId || "👤",
  experienceLevel: draft.experienceLevel || "INTERMEDIATE",
  capabilities: draft.capabilities?.length ? draft.capabilities : ["TEAM_MEMBER"],
}),
```
To:
```tsx
body: JSON.stringify({
  id: draft.id,
  alias: draft.alias,
  avatarId: draft.avatarId || "👤",
}),
```

**Step 2: Verify the PUT `/api/members/[id]` endpoint accepts partial updates**
Check `app/api/members/[id]/route.ts` and `lib/validations/` to confirm the update schema allows omitting `experienceLevel` and `capabilities`. If the schema requires them, make them optional.

**Step 3: Run linter**
Run: `npx tsc --noEmit 2>&1 | head -30`

**Step 4: Commit**
```bash
git add components/features/Identity/ProfileDetailCard.tsx
git commit -m "fix: stop sending deprecated experienceLevel/capabilities from profile card"
```

---

### Task 7: Investigate and Fix Resize Console Error

**Root Cause:** The user reports "the empty console error still appears when I operate the right resize handle on a shift node in the canvas." This needs runtime investigation.

**Files:**
- Investigate: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx` (resize callback)
- Investigate: `components/features/LaneCalendar/hooks/useCanvasActions.ts` (`handleResizeEnd`)

**Step 1: Add diagnostic logging**
In `ShiftBlockNode.tsx`, temporarily add more detailed logging to the resize callback:
```tsx
onResizeEnd={(_e, p) => {
  console.log("[resize] params:", { width: p.width, x: p.x, height: p.height, y: p.y });
  // ... existing code
}
```

**Step 2: Reproduce in browser**
Open dev tools console → select a shift on canvas → drag right resize handle. Capture the exact error message and stack trace.

**Step 3: Trace root cause from console output**
Based on the error:
- If it's a React Flow internal warning → may need version-specific handling
- If it's from `handleResizeEnd` → trace which code path produces an empty error
- If it's from the API response → check response parsing

**Step 4: Fix based on findings**
Apply minimal fix, verify error is gone.

**Step 5: Remove diagnostic logging**

**Step 6: Commit**
```bash
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx \
  components/features/LaneCalendar/hooks/useCanvasActions.ts
git commit -m "fix: resolve console error on right-handle shift resize"
```

---

### Task 8: Final Verification

**Step 1: Run full type check**
Run: `npx tsc --noEmit`
Expected: No errors.

**Step 2: Run tests**
Run: `npm test`
Expected: All pass.

**Step 3: Manual smoke test checklist**
- [ ] Create template with capacity 0 → creates shift with capacity 0 (not 2)
- [ ] Template form shows no Shift Type or Priority fields
- [ ] Template list shows no priority badges
- [ ] Admin team manage page shows no experienceLevel badges
- [ ] Admin team manage page shows no capabilities section
- [ ] MemberListByEvent shows no experienceLevel text
- [ ] Sidebar profile card shows full member info (not just name+avatar)
- [ ] Profile card save doesn't send experienceLevel/capabilities
- [ ] Right-handle resize produces no console error

**Step 4: Final commit**
```bash
git add -A
git commit -m "chore: final cleanup for backlog bugfixes"
```
