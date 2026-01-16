# Prisma Client Regeneration Fix

**Issue:** Templates API returns 500 - Prisma client missing new models

## Quick Fix

1. **Stop dev server** (Ctrl+C in terminal running `npm run dev`)

2. **Regenerate Prisma client:**
   ```powershell
   npx prisma generate
   ```

3. **Restart dev server:**
   ```powershell
   npm run dev
   ```

## Verification

Check if models are present:
```powershell
npm run db:verify
```

Should show: ✅ All models present

## Safe Migration Workflow

For future migrations:
```powershell
npm run db:migrate-safe
```

This script:
- Checks if dev server is running
- Runs migration + generates client
- Verifies client includes new models

## What to Check

**Server console logs** will show:
- Runtime warning if models missing (on startup)
- Detailed error logs if API fails (name, message, stack)

**Browser console** shows generic "Failed to fetch templates" - check server logs for details.
