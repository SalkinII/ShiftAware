-- Cleanup script for orphaned shift: cmkfpxc04000nt67nmvucpzux
-- Run this in your PostgreSQL database if the shift cannot be deleted via UI

-- Step 1: Check shift state
SELECT 
  s.id,
  s.type,
  s."eventId",
  (SELECT COUNT(*) FROM "Assignment" WHERE "shiftId" = s.id) as assignment_count,
  (SELECT COUNT(*) FROM "ShiftPreference" WHERE "shiftId" = s.id) as preference_count,
  (SELECT COUNT(*) FROM "ShiftRole" WHERE "shiftId" = s.id) as role_count
FROM "Shift" s
WHERE s.id = 'cmkfpxc04000nt67nmvucpzux';

-- Step 2: If shift exists and has assignments, delete them first
DELETE FROM "Assignment" WHERE "shiftId" = 'cmkfpxc04000nt67nmvucpzux';

-- Step 3: Delete preferences
DELETE FROM "ShiftPreference" WHERE "shiftId" = 'cmkfpxc04000nt67nmvucpzux';

-- Step 4: Delete roles
DELETE FROM "ShiftRole" WHERE "shiftId" = 'cmkfpxc04000nt67nmvucpzux';

-- Step 5: Delete the shift
DELETE FROM "Shift" WHERE id = 'cmkfpxc04000nt67nmvucpzux';

-- Step 6: Verify deletion
SELECT COUNT(*) FROM "Shift" WHERE id = 'cmkfpxc04000nt67nmvucpzux';
-- Should return 0
