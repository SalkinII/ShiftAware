# PDF Generation Performance Optimization - Design Specification

**Date:** 2026-01-16  
**Agent:** @planner  
**Status:** Design Complete

---

## Context

User selected Option A: Performance First. Need to optimize PDF generation performance in `exportScheduleToPDF` function to improve speed when exporting large schedules (100+ shifts).

---

## Current State Analysis

### Current Implementation ✅
- Uses `jsPDF` and `jspdf-autotable` libraries
- Client-side PDF generation
- Supports filtering by member, orientation, pseudonym map

### Performance Issues ❌
1. **Multiple array iterations** - `map`, `filter`, `flatMap`, `reduce` called multiple times
2. **Redundant date parsing** - `new Date()` called repeatedly for same dates
3. **String operations in loops** - `format()`, `replace()` called multiple times
4. **Inefficient member alias lookup** - `flatMap` + `find` for single member lookup
5. **Redundant calculations** - Coverage calculated with multiple `reduce` calls
6. **Footer loop** - Iterates through all pages sequentially

---

## Requirements

### Functional
- Maintain current functionality (filtering, orientation, pseudonym map)
- Preserve PDF format and appearance
- Support large datasets (100+ shifts)

### Non-Functional
- Reduce PDF generation time for 100+ shifts
- Reduce memory allocations during generation
- Improve perceived performance (show progress if needed)

### Constraints
- Must work client-side (no server-side dependencies)
- Must maintain existing API contract
- Must preserve PDF quality and formatting

---

## Solution Design

### 1. Data Preprocessing Optimization

**Single-Pass Processing:**
- Combine filtering, mapping, and sorting into fewer passes
- Pre-parse dates once, reuse parsed Date objects
- Cache formatted strings

**Member Lookup:**
- Use Map for O(1) member lookup instead of flatMap + find
- Build member map during initial pass

### 2. Calculation Optimization

**Coverage Calculation:**
- Calculate in single pass with filtered shifts
- Avoid multiple reduce operations

**Date Formatting:**
- Parse dates once, cache formatted strings
- Reuse date-fns format results

### 3. Table Data Optimization

**Assignment String Building:**
- Pre-build assignment strings during filtering pass
- Avoid repeated string concatenation
- Cache shift type replacements

### 4. Pseudonym Map Optimization

**Map Building:**
- Build map during initial shift processing
- Avoid separate iteration over assignments

### 5. Footer Optimization

**Batch Footer Updates:**
- Calculate footer text once
- Use more efficient page iteration if possible

---

## Implementation Plan

### Phase 1: Data Preprocessing
1. Single-pass filtering and mapping
2. Pre-parse all dates
3. Build member map during initial pass

### Phase 2: Calculation Optimization
1. Combine coverage calculation with filtering
2. Cache formatted strings
3. Optimize assignment string building

### Phase 3: Table Generation
1. Pre-build table data array efficiently
2. Optimize autoTable options

### Phase 4: Advanced Optimizations (if needed)
1. Add progress callback for large exports
2. Consider web worker for very large datasets
3. Lazy page generation

---

## Success Criteria

- [ ] PDF generation time < 2s for 100 shifts
- [ ] Reduced memory allocations
- [ ] All existing functionality preserved
- [ ] PDF format and quality maintained

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Incremental changes with testing |
| Memory issues with very large datasets | Add progress feedback, consider chunking |
| Date/timezone issues | Preserve existing date handling logic |

---

## Implementation Notes for @implementer

1. **Optimize data processing:**
   - Single-pass filtering and mapping
   - Pre-parse dates
   - Build member map efficiently

2. **Cache computations:**
   - Cache formatted date strings
   - Cache shift type replacements
   - Cache assignment strings

3. **Reduce iterations:**
   - Combine reduce operations
   - Minimize array operations
   - Use Map/Set for lookups

4. **Test with large datasets:**
   - Test with 50, 100, 200+ shifts
   - Measure generation time
   - Verify PDF quality

---

## Alternatives Considered

### 1. Server-Side PDF Generation
**Rejected:** Adds server dependency, current client-side approach is simpler

### 2. Web Workers
**Rejected:** Adds complexity, may not be needed if optimizations sufficient

### 3. Different PDF Library
**Rejected:** jsPDF is well-established, switching would require rewrite

---

## Next Steps

Delegate to @implementer to:
1. Optimize data preprocessing (single-pass)
2. Cache date parsing and formatting
3. Optimize table data generation
4. Measure and iterate
