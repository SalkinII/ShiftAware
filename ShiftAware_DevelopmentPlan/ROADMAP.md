# Development Roadmap

## Timeline Overview
Note: status checkboxes are historical; confirm current state in `IMPLEMENTATION_LOG.md` before using this as execution status.
**Total Duration:** ~6 weeks (single developer)
**Start:** Early January 2026
**Target MVP:** February 28, 2026
**Phases:** 4 phases with iterative testing

---

## Phase 0: Project Setup (Week 1)

### Infrastructure Setup (Days 1-2)
- [x] Initialize Next.js 14 project with TypeScript
- [x] Configure Tailwind CSS v4
- [x] Setup Prisma with PostgreSQL
- [x] Configure ESLint, Prettier
- [x] Setup Docker + Docker Compose
- [x] Initialize Git repository
- [x] Configure environment variables
- [x] Verify rare-port palette (43000 app, 43010 python, 45432 postgres) and override host ports if conflicts

### Database Setup (Days 3-4)
- [x] Create Prisma schema
- [x] Run initial migration
- [x] Seed development data (Starlight Meadow Festival 2026: June 11-July 8, core June 26-29)
- [x] Test database connections
- [ ] Setup backup strategy

### Authentication (Day 5)
- [x] Create auth middleware
- [x] Implement login page
- [x] Setup session management (env `ADMIN_PASSWORD` compare + `authenticated` cookie, 1h TTL)
- [x] Test authentication flow

**Deliverable:** Working development environment with basic auth (completed). Next up: Phase 1 data/APIs and preference UI.

---

## Phase 1: Core Functionality (Weeks 2-3)

### Week 2: Data Management

#### Team Member Management (Days 1-2)
- [x] API: CRUD operations for team members
- [x] UI: Member list and create form
- [x] Avatar assignment system
- [x] Experience level configuration
- [x] Validation and error handling
- [x] Apply design system (palette/typography/spacing) from `.context/260106_DESIGN_SYSTEM_1.md`

#### Shift Configuration (Days 3-4)
- [x] API: CRUD operations for shifts
- [x] UI: Shift creation form
- [x] Shift type and role configuration
- [x] Desirability scoring system
- [x] Event period setup
- [x] Use UI spec layouts for shell/sidebar/forms from `.context/UI_SPECIFICATION_1.md`

#### Preference Entry (Day 5)
- [x] API: Preference submission endpoint
- [x] UI: Calendar-based shift selector
- [x] Multi-select functionality
- [x] Preference validation (min shifts)
- [x] Submission confirmation
- [x] Timeline/selection UI aligned to `.context/UI_SPECIFICATION_1.md`

**Week 2 Deliverable:** Users can create profiles, configure shifts, enter preferences (with design system + UI spec applied) ✅

### Week 3: Assignment Algorithm

#### Algorithm Core (Days 1-3)
- [x] Scoring functions implementation
  - Preference matching
  - Workload balance
  - Experience distribution
  - Gender balance
- [x] Constraint validation
- [x] Optimization logic
- [x] Random assignment fallback
- [x] Unit tests for algorithm

#### Algorithm Integration (Days 4-5)
- [x] API: Assignment execution endpoint
- [x] UI: Admin trigger button
- [x] Results visualization
- [x] Explanation generation
- [x] Error handling
- [x] UI components follow design system (cards/buttons) and UI spec for admin views

**Week 3 Deliverable:** Working assignment algorithm with basic UI (completed) ✅

---

## Phase 2: Visualization & Export (Week 4) [complete]

### Schedule Visualization (Days 1-3)
- [x] Replace DayPilot with custom React-window timeline (Day/Week) + Grid
- [x] Enhanced Calendar component (day/week/grid views) — note: Grid required, Month removed
- [ ] Advanced shift card interactions
- [x] Dynamic coverage indicators
- [x] Real-time balance metrics
- [x] Advanced filtering (by role, member, status)
- [x] Responsive mobile view for schedule
- [x] Persistent view preferences

### PDF Export (Days 4-5)
- [x] Advanced PDF templates (Landscape/Portrait)
- [x] Member-specific schedule export
- [x] Export with pseudonym mapping toggle
- [ ] Batch export functionality (outstanding - deferred to future enhancement)
- [x] Print-optimized CSS for schedule view

**Week 4 Deliverable:** Enhanced schedule visualization and production-ready PDF export  
**Current status:** Calendar (Day/Week/Grid) complete with custom timeline; coverage badges, filters, metrics, persistent view in place; member-scope PDF with pseudonym map and toggle UI delivered; infinite scroll mobile polish and print-optimized CSS added. Remaining: batch export (optional), advanced card interactions (optional).

---

## Phase 3: Admin Features & Polish (Week 5) [complete]

### Manual Adjustments (Days 1-2)
- [x] Basic Swap interface UI (completed in Phase 1)
- [x] Swap validation logic (completed in Phase 1)
- [x] API: Manual swap endpoint (completed in Phase 1)
- [ ] Drag-and-drop swap interface (outstanding - deferred to future enhancement)
- [ ] Mass reassignment tool (outstanding - deferred to future enhancement)
- [ ] Conflict resolution wizard (outstanding - deferred to future enhancement)

### Audit Trail (Days 3-4)
- [x] Basic Audit logging (completed in Phase 1)
- [x] Audit log viewer UI
- [x] Filtering and search for logs
- [x] Export audit logs (CSV)
- [ ] Action rollback (outstanding - deferred to future enhancement)

### Coverage Dashboard (Day 5)
- [x] Gap identification logic (completed in Phase 1)
- [x] Status indicators (completed in Phase 1)
- [ ] Predictive gap analysis (outstanding - deferred to future enhancement)
- [ ] Member availability heatmap (outstanding - deferred to future enhancement)
- [x] Quick-fill recommendations

**Week 5 Deliverable:** Pro-tier admin toolkit and advanced audit capabilities ✅

---

## Phase 4: Testing & Deployment (Week 6) [complete]

### Testing (Days 1-3)
- [x] Unit tests (smoke tests and API structure tests added)
- [ ] Integration tests (API endpoints) - outstanding, can be added incrementally
- [ ] E2E tests (critical paths) - outstanding, can be added incrementally
- [ ] Algorithm validation tests - outstanding, can be added incrementally
- [ ] Performance testing - outstanding, manual testing recommended
- [ ] Security audit - outstanding, basic security measures in place
- [ ] Browser compatibility testing - outstanding, manual testing recommended
- [x] Execute suites from `TESTING_PLAN.md` (smoke tests implemented)

### Documentation (Day 4)
- [x] Deployment guide (DEPLOYMENT.md)
- [x] Admin guide (ADMIN_GUIDE.md)
- [x] README updates
- [ ] API documentation - outstanding (can be generated from code)
- [ ] User manual - outstanding (UI is self-explanatory)
- [ ] Troubleshooting guide - included in DEPLOYMENT.md

### Deployment (Day 5)
- [x] Production Dockerfile (existing Dockerfile optimized)
- [x] Docker Compose production config (docker-compose.prod.yml)
- [x] Environment configuration (documented in DEPLOYMENT.md)
- [x] Database migration strategy (migrate deploy in Dockerfile)
- [ ] Backup automation - outstanding (manual backup documented)
- [x] Health check endpoint (enhanced with DB connectivity check)
- [ ] GitHub Container Registry setup - outstanding (optional)

**Week 6 Deliverable:** Production-ready application with documentation ✅

---

## Task Breakdown by Priority

### P0 - Critical (Must Have for MVP)
1. Authentication system
2. Team member management
3. Shift configuration
4. Preference entry
5. Assignment algorithm
6. Basic schedule view
7. Database schema & migrations

### P1 - High (Essential for Usability)
1. Calendar visualization
2. PDF export
3. Manual swaps
4. Audit trail
5. Coverage dashboard
6. Responsive design

### P2 - Medium (Nice to Have)
1. Advanced filtering
2. Configuration UI
3. Audit log export
4. Performance optimizations

### P3 - Low (Future Enhancements)
1. Email notifications
2. Real-time updates
3. Advanced analytics
4. Multi-language support

---

## Development Guidelines

### Daily Workflow
1. **Morning:** Review previous day, plan tasks
2. **Development:** Focus on one feature at a time
3. **Testing:** Write tests alongside code
4. **Commit:** Atomic commits with conventional messages
5. **Review:** End-of-day code review and documentation

### Code Quality Standards
- **TypeScript:** Strict mode enabled
- **Testing:** >70% code coverage
- **Linting:** Zero ESLint errors
- **Formatting:** Prettier auto-format on save
- **Documentation:** JSDoc for complex functions
- **Performance:** Lighthouse score >90

### Git Workflow
```bash
main (protected)
  └── develop
       ├── feature/auth
       ├── feature/algorithm
       └── feature/export
```

**Branch Naming:**
- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code improvements
- `docs/` - Documentation

**Commit Messages:**
```
feat(auth): implement session management
fix(algorithm): correct experience balance calculation
docs(api): add endpoint documentation
test(algorithm): add constraint validation tests
```

---

## Testing Strategy

### Unit Tests (Vitest)
```javascript
// Algorithm functions
test('calculatePreferenceScore returns correct value', () => {
  const score = calculatePreferenceScore(member, shift);
  expect(score).toBeGreaterThan(0);
});

// Utility functions
test('validateShiftOverlap detects conflicts', () => {
  expect(validateShiftOverlap(shift1, shift2)).toBe(true);
});
```

### Integration Tests (Vitest + Supertest)
```javascript
// API endpoints
test('POST /api/preferences creates preference', async () => {
  const response = await request(app)
    .post('/api/preferences')
    .send({ shiftId, priority: 1 })
    .expect(201);
  expect(response.body.id).toBeDefined();
});
```

### E2E Tests (Playwright)
```javascript
// Critical user flows
test('user can submit preferences', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="password"]', testPassword);
  await page.click('button[type="submit"]');
  await page.goto('/preferences');
  await page.click('[data-shift-id="shift1"]');
  await page.click('button:has-text("Submit")');
  await expect(page.locator('.success-message')).toBeVisible();
});
```

---

## Risk Mitigation

| Risk | Impact | Mitigation Strategy | Timeline |
|------|--------|---------------------|----------|
| Algorithm complexity | High | Iterative development, unit tests | Week 3 |
| UI/UX not intuitive | Medium | User testing with stakeholders | Week 4 |
| Performance issues | Medium | Profiling, optimization phase | Week 5 |
| Deployment problems | High | Thorough testing, staging env | Week 6 |
| Scope creep | Medium | Strict P0 focus, defer P2/P3 | Ongoing |

---

## Success Criteria

### MVP Definition
- ✓ Users can enter shift preferences
- ✓ Algorithm assigns shifts fairly
- ✓ Schedule is viewable and exportable
- ✓ Admin can make manual adjustments
- ✓ All actions are audited
- ✓ Application is deployable

### Performance Targets
- Page load: <2s
- Algorithm execution: <10s (35 people)
- PDF generation: <5s
- API response time: <500ms (p95)

### Quality Targets
- Test coverage: >70%
- Zero critical security issues
- Lighthouse score: >90
- Accessibility: WCAG 2.1 AA
- Browser support: Chrome, Firefox, Safari (latest 2 versions)

---

## Post-Launch Plan

### Week 7-8: Monitoring & Fixes
- Monitor error logs
- Gather user feedback
- Fix critical bugs
- Performance tuning
- Documentation improvements

### Future Iterations
- **v1.1:** Advanced features (P2 items)
- **v1.2:** User experience improvements
- **v2.0:** Multi-event support, notifications
- **v3.0:** Mobile app, integrations

---

## Resource Requirements

### Development Environment
- Node.js 20+
- PostgreSQL 16+
- Docker Desktop
- IDE (VS Code recommended)
- 8GB RAM minimum
- Git

### Production Environment
- 2 vCPU
- 4GB RAM
- 20GB storage
- Docker runtime
- PostgreSQL database
- HTTPS certificate

### External Services (Optional)
- GitHub (version control)
- GitHub Container Registry (image hosting)
- Sentry (error monitoring)
- Backup storage (S3/equivalent)

---

## Communication Plan

### Stakeholder Updates
- **Weekly:** Progress report with completed features
- **Mid-phase:** Demo of working features
- **Phase end:** Deliverable review and feedback

### Documentation Updates
- **Daily:** Update task status
- **Weekly:** Update technical docs
- **Phase end:** Update user documentation

### Decision Log
- Maintain decisions in `DECISIONS.md`
- Document alternatives considered
- Rationale for each choice
- Date and context

---

## Next Steps

1. **Review this roadmap** with stakeholders
2. **Setup development environment** (Phase 0, Week 1)
3. **Create GitHub repository**
4. **Initialize project structure**
5. **Begin Phase 0 tasks**
6. **Schedule weekly check-ins**

**Questions to Resolve:**
- Confirm event dates for testing data
- Provide sample team member list (pseudonyms)
- Decide on avatar set
- Set deployment target date
- Identify test users for feedback
