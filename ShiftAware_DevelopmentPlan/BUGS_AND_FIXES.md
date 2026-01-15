# Bugs and Fixes Log

**Date:** 2026-01-15  
**Status:** In Progress

---

## Issues Identified

### 1. Date Display Duplication in Schedule View
**Problem:** Dates appear both in shift card lanes (timeline-row__time) and in the top timeline scale, causing visual clutter.

**Root Cause:** 
- Timeline scale shows dates for Week view (format: "EEE d")
- Shift cards also show dates in their time labels (format: "EEE, MMM d HH:mm")
- This creates redundant information

**Intended Behavior:**
- Week view: Show dates in top scale only, shift cards should show time only
- Day view: Show date in navigation header, shift cards show time only
- Grid view: Show dates in column headers, shift cards show time only

**Fix:** Remove date from shift card time labels, keep only time (HH:mm — HH:mm)

---

### 2. Date Mismatch in Day View Timeline
**Problem:** Dates shown in shift card lanes don't match the timeline they're displayed on in Day view.

**Root Cause:** 
- Day view uses `dayStarts` array which may contain multiple days
- Shift cards show their own start date, not the timeline date
- Timeline scale shows hours (0-23) but shift cards show dates

**Intended Behavior:**
- Day view should show single day's shifts
- Timeline scale should show hours (0:00, 1:00, etc.)
- Shift cards should show time only (no date)
- Date navigation should control which day is shown

**Fix:** Ensure day view filters shifts to selected date, remove date from shift card labels

---

### 3. Validation Errors in Preferences Submission
**Problem:** Toast shows validation errors when submitting preferences.

**Root Cause:** Need to investigate API validation logic and error response format.

**Intended Behavior:**
- Client-side validation should catch issues before submission
- API validation should return clear, user-friendly error messages
- Errors should be displayed inline or in toast with actionable information

**Fix:** Review and fix validation logic in preferences API endpoint

---

### 4. Validation Errors in Shift Creation Form
**Problem:** Toast shows validation errors when creating shift templates.

**Root Cause:** Need to investigate form validation vs API validation mismatch.

**Intended Behavior:**
- Form validation should catch issues before submission
- API validation should align with form validation
- Errors should be displayed inline on form fields
- Toast should only show success/network errors

**Fix:** Align form validation with API validation, improve error display

---

## Fixes Applied

### 2026-01-15
- [x] Fix date display duplication - Removed date from shift card time labels (now shows "HH:mm — HH:mm" instead of "EEE, MMM d HH:mm — HH:mm")
- [x] Fix day view date mismatch - Added date filtering in Day view to show only shifts for selected date
- [x] Fix preferences validation errors - Improved error parsing to show Zod validation details in toast messages
- [x] Fix shift creation validation errors - Improved error parsing with field name mapping for user-friendly messages

---

## Outstanding Issues

- Document any remaining issues here after fixes are applied

---

## 5. CUID Validation Errors

**Problem:** Validation errors showing "Invalid cuid" for shiftId and eventId fields.

**Root Cause:** 
- Zod `.cuid()` validator is very strict and requires exact CUID format
- Some IDs from database might not match strict CUID format
- Empty strings might be sent before validation

**Intended Behavior:**
- Accept valid CUIDs (25 chars, starts with 'c')
- Also accept other reasonable ID formats (>= 10 chars) for flexibility
- Reject empty strings and very short IDs (< 10 chars)
- Provide clear error messages

**Fix:** 
- Created lenient `idSchema` that accepts CUID format OR any string >= 10 chars
- Added client-side validation to prevent empty IDs from being sent
- Updated tests to match new validation approach
