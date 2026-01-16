# Known Issues

**Last Updated:** 2026-01-16

---

## Shift Templates (v1.1.0)

**Issue:** Prisma client regeneration blocked by dev server file lock  
**Status:** Resolved  
**Fix:** Use `npm run db:migrate-safe` script (checks for running dev server, runs migrate + generate, verifies client)  
**Workaround:** Stop dev server → `npx prisma migrate dev` → `npx prisma generate` → restart dev server  
**Impact:** Templates API returns 500 if client not regenerated (helpful error message provided)

---

## Timeline View (Deferred)

1. Day view multi-day shift display
2. Week view vertical scrolling
3. Grid view compactness
4. Swap interface two-column layout

**Status:** Documented, deferred to post-v1.1.0
