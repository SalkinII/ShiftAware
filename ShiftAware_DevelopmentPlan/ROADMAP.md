# Roadmap: v1.1.0 and Beyond

**Last Updated:** 2026-01-16  
**Current Status:** v1.1.0 in development

---

## Current Status Summary

### ✅ Completed (v1.1.0)
- Playwright test fixes (timeouts, navigation waits)
- Dead weight removal (non-functional buttons)
- Design System v2 Phase 1 (design tokens)
- Design System v2 Phase 2 - Button component
- Fixed infinite loop in useCache (pages loading forever)
- Standardized loading UI (Skeleton components)

### 🔄 In Progress
- Design System v2 Phase 2 (Input, Card, Navigation components)
- Unused components audit

---

## Immediate Next Steps (v1.1.0)

### 1. Complete Design System v2 Component Migration
**Priority:** High  
**Status:** Button ✅, Input/Card/Navigation pending

- **Input Component:** Error states, help text, focus rings
- **Card Component:** Elevation levels, hover effects
- **Navigation:** Active states, focus indicators, transitions

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
