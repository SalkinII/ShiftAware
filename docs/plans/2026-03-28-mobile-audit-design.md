# Mobile Audit Design

**Date:** 2026-03-28  
**Branch:** fix-optimise4mobile  
**Status:** Approved — proceed to implementation plan

---

## Problem

The app's member and admin views have layout issues on mobile: cards and text do not organise correctly within available screen width, components stack unexpectedly, and some elements do not display properly. The React Flow canvas is acceptable; the surrounding UI chrome and panel layouts are not.

## Goal

Produce a detailed evidence base (screenshots + accessibility snapshots + written findings) for every page and interactive state in the app at 390px viewport width, covering both member and admin journeys. Use those findings to drive a targeted improvement plan.

## Approach: Journey-Based Interaction Audit

**Viewport:** 390 × 844 px (iPhone 14 — industry standard for "standard phone")  
**Tool:** playwright-cli  
**Single viewport:** keeps output focused and comparable across states.

Static screenshots miss interactive layout failures. Following complete user journeys — capturing modals open, panels slid in, sidebars overlaid — reveals the real breakage.

## Journeys

### Journey 1 — Member flow (9 states)
1. Login page
2. Identity page — member list loaded
3. Identity page — event selection step
4. Calendar → My Shifts view (default)
5. My Shifts → shift card tapped (preference panel or detail open)
6. Calendar → Full Schedule view
7. Full Schedule → shift tapped (320px side panel + canvas in flex row)
8. Full Schedule → swap modal open
9. Hamburger menu → mobile sidebar overlay open

### Journey 2 — Admin flow (7 states)
1. Admin setup page (festival settings, template manager, attributes sections)
2. Admin shifts / schedule page (canvas chrome + surrounding layout)
3. Admin team page
4. Admin team / manage page
5. Admin audit log page
6. Admin mobile sidebar open
7. Any modal that opens (algorithm results, conflict wizard if accessible)

## Output

The executing agent produces:
- `docs/mobile-audit/2026-03-28-findings.md` — running log with screenshot paths, issue description, severity
- Screenshot files in `docs/mobile-audit/screenshots/`
- Severity scale: **broken** (layout unusable) / **cramped** (functional but poor UX) / **cosmetic** (minor)

## Known Suspects from Code Review

| Area | File | Issue |
|---|---|---|
| Calendar full-schedule layout | `app/(routes)/app/calendar/page.tsx:699` | `w-80 flex-shrink-0` panel + canvas in flex row — no wrap on mobile |
| Desirability legend | same file:630 | `flex items-center gap-3` without wrap — likely overflows 390px |
| App layout main offset | `app/(routes)/app/layout.tsx:20` | `lg:pl-64` correct, but check no rogue spacing on mobile |
| Header identity info | `components/layout/Header.tsx:111` | `hidden md:flex` — identity display invisible on mobile |
| Header user name | same:121 | `hidden md:block` — role label invisible on mobile |
| Swap modal | calendar page:784 | `p-4` on fixed inset — check content fits 390px |
| Admin sidebar | `components/layout/AdminSidebar.tsx` | Not yet read — assume similar pattern |

## Next Step

Implement as detailed playwright-cli plan: `docs/plans/2026-03-28-mobile-audit-plan.md`
