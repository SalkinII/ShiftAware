# Known Issues

**Last Updated:** 2026-01-16

---

## Shift Templates (v1.1.0)

**Issue:** Prisma client regeneration required after migration  
**Status:** Blocking  
**Fix:** Restart dev server after `npx prisma migrate dev` to include new models (`shiftTemplate`, `shiftTemplateRole`, `scheduledShift`)  
**Impact:** Templates API returns 500 until client regenerated

---

## Timeline View (Deferred)

1. Day view multi-day shift display
2. Week view vertical scrolling
3. Grid view compactness
4. Swap interface two-column layout

**Status:** Documented, deferred to post-v1.1.0
