# Caching Strategy Design

**Date:** 2026-01-16  
**Status:** Phase 1 Complete, Phase 2 Complete  
**Agent:** @planner → @implementer

---

## Context

Currently, the application fetches data from APIs on every page load without caching. Frequently accessed endpoints like `/api/shifts`, `/api/events`, and `/api/assignments` are called multiple times across different pages, leading to unnecessary network requests and slower page loads.

---

## Requirements

### Functional Requirements
- Cache frequently accessed data (events, shifts, assignments)
- Invalidate cache on mutations (create/update/delete operations)
- Support cache invalidation via custom events (cross-page communication)
- Maintain cache consistency across pages

### Non-Functional Requirements
- Simple implementation (avoid heavy dependencies)
- Low memory footprint (small dataset: 25-35 users, ~100 shifts)
- Fast cache lookups
- Easy to debug and maintain

### Constraints
- Next.js App Router architecture
- Client-side React components
- No external caching service (Redis, etc.)
- Single-user application (no multi-user cache conflicts)

---

## Solution

### Approach: Client-Side In-Memory Cache with React Context

**Rationale:**
- Simple to implement
- No external dependencies
- Sufficient for small-scale application
- Easy to invalidate via React context
- Can be extended later if needed

### Components

1. **Cache Provider (`lib/cache/CacheProvider.tsx`)**
   - React Context provider
   - Stores cache state (Map<string, CacheEntry>)
   - Provides cache get/set/invalidate methods
   - Handles cache expiration (optional TTL)

2. **Cache Hook (`lib/cache/useCache.ts`)**
   - Custom hook for components
   - Wraps fetch calls with caching
   - Returns cached data or triggers fetch
   - Handles loading/error states

3. **Cache Utilities (`lib/cache/utils.ts`)**
   - Cache key generation
   - Cache entry structure
   - TTL management

### Data Structure

```typescript
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl?: number; // optional time-to-live in milliseconds
}

interface CacheContextValue {
  get: (key: string) => CacheEntry | null;
  set: (key: string, data: any, ttl?: number) => void;
  invalidate: (key: string | string[]) => void;
  clear: () => void;
}
```

### Cache Keys

- `events` - All events
- `shifts` - All shifts
- `shifts:event:${eventId}` - Shifts for specific event
- `assignments` - All assignments
- `assignments:event:${eventId}` - Assignments for specific event
- `members` - All team members

### Cache Invalidation Strategy

**Automatic Invalidation:**
- On shift create/update/delete → invalidate `shifts*` keys
- On assignment create/update/delete → invalidate `assignments*` keys
- On event create/update/delete → invalidate `events` and related keys
- On member create/update/delete → invalidate `members` key

**Manual Invalidation:**
- Via custom events (e.g., `shiftaware:refresh-schedule`)
- Via cache hook invalidation method

### Implementation Phases

**Phase 1: Basic Cache (MVP)**
- Create CacheProvider with in-memory Map
- Create useCache hook
- Integrate with schedule page
- Manual invalidation only

**Phase 2: Automatic Invalidation** ✅ COMPLETE
- ✅ Add invalidation on mutations (client-side dispatch after successful API calls)
- ✅ Integrate with all data-fetching pages (dashboard, assignments, coverage, members, preferences, export, schedule)
- ⏸️ Add TTL support (optional - deferred, not needed for current use case)

**Phase 3: Advanced Features (Future)**
- Cache persistence (localStorage)
- Cache size limits
- Cache statistics/monitoring

---

## Alternatives Considered

### 1. React Query / TanStack Query
**Pros:** Feature-rich, battle-tested, automatic cache management  
**Cons:** Additional dependency, might be overkill for small app  
**Decision:** Deferred - can migrate later if needed

### 2. SWR (Stale-While-Revalidate)
**Pros:** Simple API, automatic revalidation  
**Cons:** Additional dependency, might be overkill  
**Decision:** Deferred - can migrate later if needed

### 3. Next.js Server-Side Caching
**Pros:** Built-in, no client code  
**Cons:** Doesn't help with client-side navigation, requires API route changes  
**Decision:** Not suitable for client-side data fetching patterns

---

## Risks

1. **Cache Staleness:** Data might be outdated if invalidation fails
   - **Mitigation:** Manual refresh buttons, clear cache on errors

2. **Memory Usage:** Cache grows over time
   - **Mitigation:** Small dataset, can add size limits later

3. **Complexity:** Adding caching layer increases code complexity
   - **Mitigation:** Keep implementation simple, well-documented

---

## Implementation Notes for @implementer

1. Start with Phase 1 (basic cache)
2. Create `lib/cache/` directory structure
3. Use React Context API for cache state management
4. Integrate with existing `loadSchedule()` and similar functions
5. Test cache invalidation with shift creation
6. Add cache invalidation to mutation endpoints (POST/PUT/DELETE)

---

## Success Criteria

- [ ] Cache reduces API calls by at least 50% on navigation
- [ ] Cache invalidation works correctly on mutations
- [ ] No cache-related bugs or stale data issues
- [ ] Implementation is simple and maintainable
