# Roadmap: v1.1.0 and Beyond

**Last Updated:** 2026-01-16  
**Current Status:** v1.1.0 in development

---

## Current Status Summary

### ✅ Completed (v1.1.0)
- Playwright test fixes (timeouts, navigation waits)
- Dead weight removal (non-functional buttons)
- Design System v2 Phase 1 & 2 complete (tokens, Button, Input, Card, Navigation)
- Fixed infinite loop in useCache (pages loading forever)
- Standardized loading UI (Skeleton components)
- Shift Templates (schema, API, UI, drag-drop integration)

---

## Immediate Next Steps (v1.1.0)

### 1. Shift Templates Testing & Refinement
**Priority:** High  
**Status:** Implementation complete, testing pending

- Fix Prisma client regeneration issue (see KNOWN_ISSUES.md)
- Test template creation, drag-drop, shift conversion
- Refine UI/UX based on testing

### 2. Reactive Patterns Implementation
**Priority:** Medium  
**Status:** Planned

- Progressive disclosure (collapsible sections, tooltips)
- Contextual feedback (inline validation, optimistic updates)
- Smooth transitions (200-300ms, ease-in-out)
- Responsive interactions (touch targets, keyboard navigation)

### 3. UI Polish & Accessibility
**Priority:** Medium  
**Status:** Planned

- Visual consistency check
- Accessibility audit (WCAG 2.1 AA)
- Cross-browser testing
- Mobile responsiveness verification

---

## Future Enhancements (Post-v1.1.0)

### Timeline View Improvements
- Day view multi-day shift display
- Week view vertical scrolling
- Grid view compactness
- Swap interface two-column layout

### Advanced Features
- Notifications system
- Multi-event support
- Enhanced conflict resolution
- Advanced filtering and search

### Technical Debt
- Complete `any` types cleanup
- Unused variables cleanup
- Code splitting optimization
- Performance monitoring

---

## User Input Pending
**Awaiting:** Specific guidance on app improvements

---

## Notes

- All core functionality complete and production-ready (v1.0.0)
- Focus on UI/UX improvements and polish (v1.1.0)
- Documentation maintained in core files only
