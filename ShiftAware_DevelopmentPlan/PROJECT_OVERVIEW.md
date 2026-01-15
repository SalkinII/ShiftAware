# ShiftAware - Shift Management System
## Project Overview

### Purpose
A lightweight, privacy-focused shift management tool for coordinating a rotating schedule for 25-35 people across multiple team roles with varying experience levels and shift preferences.

### Core Philosophy
- **Privacy First**: Pseudonymized representation throughout the system
- **Transparency**: All algorithmic decisions are visible and explainable
- **Modern & Professional**: High-end UI/UX with modern aesthetics (gradients, rich shadows, refined typography) while remaining resource-efficient
- **Non-Profit**: MIT/Apache2 licensed, community-focused
- **Audit Trail**: Full transaction logging for rollback capability

### Target Users
- **Primary**: Shift coordinators/administrators managing schedules
- **Secondary**: Team members viewing schedules and entering preferences

### Key Constraints
1. **No PII Storage**: Only pseudonymized aliases in database
2. **Minimal Authentication**: Single password barrier (low-risk environment)
3. **Resource Efficient**: Designed for small-scale deployment
4. **Manual Override**: Admin can manually adjust assignments

### Success Criteria
- Fast shift preference entry (<2 minutes per person)
- Optimal shift distribution balancing experience, gender, and preferences
- Clear visualization of coverage gaps
- Export capability for offline use
- Manual pseudonym-to-name conversion for printing

---

## Project Scope

### In Scope
1. Web-based shift preference collection
2. Algorithmic shift assignment with transparent logic
3. Balance constraints (experience, gender, shift desirability)
4. PDF export functionality
5. Basic authentication
6. Transaction logging
7. Containerized deployment

### Out of Scope
1. Complex user management/roles
2. Mobile native applications
3. Real-time collaboration features
4. Integration with external calendar systems
5. Advanced analytics/reporting
6. Automated notifications
7. Pseudonym-to-name mapping storage/management (handled externally)

### Phases
**Phase 1**: Core functionality (preference entry, assignment algorithm, display)
**Phase 2**: Export and printing support
**Phase 3**: Manual adjustment tools
**Phase 4**: Polish and optimization

---

## Stakeholder Requirements

### Administrator (Shift Coordinator)
- Manual shift swap capability
- Clear view of coverage gaps
- Export schedules to PDF
- Conversion table for pseudonym → real name
- Full audit trail access

### Team Members
- Simple preference entry interface
- View assigned shifts
- Understand assignment rationale
- Access via secure but simple authentication

### Technical Requirements
- Fast page loads (<2s)
- Works on mobile and desktop
- Containerized for easy deployment
- GitHub Container Registry distribution
- Robust database with backup capability

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Pseudonym confusion on-site | Medium | Provide clear conversion table |
| Algorithm bias/unfairness | Medium | Transparent logic, manual override |
| Data loss | Low | Transaction logging, regular backups |
| Unauthorized access | Low | Basic auth + low-value data |
| Scheduling conflicts | Medium | Validation rules, admin override |

---

## Success Metrics
- Time to complete preference entry: <2 minutes
- Admin time to finalize schedule: <30 minutes
- Schedule fairness score: >80% satisfaction
- System availability: >95%
- Zero PII leaks
- Production target: February 28, 2026

---

## Next Steps
1. ✅ Phase 0-4 complete: All core project phases delivered (infrastructure, core functionality, visualization/export, admin features, testing/deployment)
2. 🚧 Current: Iteration v0.3.0 - Deferred features and enhancements (UX improvements, performance optimizations, advanced admin features)
3. 📋 Future: Iteration v0.4.0+ - Timeline view improvements, two-column swap interface, conflict resolution wizard, action rollback, availability heatmap

**Current Status:** MVP complete and production-ready. See `PROJECT_STATUS.md` for detailed status and `ITERATION_v0.3.0.md` for current work.
