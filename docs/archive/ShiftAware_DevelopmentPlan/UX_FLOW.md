# UX Flow Overview
**Date:** 2026-01-16  
**Owner:** @orchestrator  
**Scope:** Admin + user flows, information flow, improvement targets

---

## Purpose
Define how admins and team members move through the system, what information they need at each step, and where the current UI breaks flow.

---

## Information Flow (System-Level)
1. **Event setup** (admin) creates the schedule space (shifts, roles, capacity).
2. **Preferences** (team members) supply demand and availability.
3. **Assignment run** (admin) produces initial allocations.
4. **Manual adjustments** (admin and team members) resolve mismatches.
5. **Conflicts** (system) are detected and resolved with guidance.
6. **Export** (admin) provides final outputs.

---

## Admin Flow (Ideal)
1. **Create Event + Shifts**  
   Create shifts, roles, capacity, and templates (if used).
2. **Collect Preferences**  
   Track who submitted preferences and where gaps exist.
3. **Run Assignment Engine**  
   Review score and coverage summary.
4. **Adjust and Resolve**  
   Drag shifts in calendar to adjust, or swap assignments in a calendar-based view.
   Conflicts appear inline and route to resolution tools.
5. **Export**  
   Export is centralized on `/export` only (no duplicate widgets).

---

## Team Member Flow (Ideal)
1. **View Schedule**  
   Personal view of upcoming shifts.
2. **Submit Preferences**  
   Preference entry with clear feedback.
3. **Swap Requests**  
   Calendar view showing available swaps and conflicts.
4. **Resolution Feedback**  
   When a swap triggers a conflict, show clear resolution steps.

---

## Current Flow Breaks
- Export appears in multiple places (dashboard quick report, schedule widget, export page).
- PDF export quality is poor and orientation icons appear swapped.
- Swap UI lacks calendar-based context for decision-making.
- Schedule view does not support direct drag of shifts into dates.
- Conflict resolution is not woven into swap and rescheduling flows.

---

## Improvement Targets (Flow-Driven)
1. **Centralize Export**
   - Keep all export UI on `/export`.
   - Remove duplicate export buttons/widgets elsewhere.
   - Fix export orientation icons and improve PDF output quality.

2. **Calendar-Based Interactions**
   - Admin: drag shifts into calendar to reschedule.
   - Swap: calendar-based view for swaps (not just list/grid).
   - Provide immediate conflict detection and resolution prompts.

3. **Role Separation**
   - Admin views focus on configuration and adjustments.
   - Team member views focus on personal schedule and swaps.

---

## Decisions (Pending)
- Where shift drag-and-drop lives (Schedule view vs dedicated admin calendar).
- Swap flow: two-column vs calendar overlay.
- Conflict resolution: inline modal vs separate route.

---

## Next Actions
- Produce plan that sequences the above targets.
- Remove redundant export UI.
- Fix PDF export output and orientation icons.
- Implement drag-and-drop shift rescheduling in calendar.
- Implement calendar-based swap flow integrated with conflicts.
