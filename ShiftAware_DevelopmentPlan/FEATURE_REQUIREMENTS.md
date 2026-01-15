# Feature Requirements Specification

**Status:** Requirements only. Implementation status is tracked in `ROADMAP.md` and `IMPLEMENTATION_LOG.md`.

## FR-001: Shift Preference Entry

### User Story
As a team member, I want to enter my shift preferences so the system can assign me to suitable shifts.

### Requirements
- Display all available shifts in calendar format
- Multi-select interface for desired shifts
- Visual indication of shift desirability (rating system)
- Mobile-responsive design
- Save draft functionality
- Confirmation before submission

### Acceptance Criteria
- [x] User can view all shifts for the event period
- [x] User can select multiple preferred shifts
- [x] Selected shifts are clearly highlighted
- [x] Minimum shift count validation (2 shifts)
- [x] Changes are saved to database
- [x] User receives confirmation message

### Priority: **P0 (Critical)**

---

## FR-002: Shift Configuration

### User Story
As an administrator, I need to define shift types, times, and team compositions.

### Requirements
- Define shift structure:
  - 2x Mobile teams (2 people each)
  - 1x Stationary team (2 people, 1 is shift lead)
  - 1x Executive shift
- Event period: June 11-July 8, 2026 (buffer + core)
- Core event days: Thursday-Monday, June 26-29 (min-shift rules apply only to core)
- Buffer days are excluded from minimum shift requirements
- Set shift times (Thursday to Monday midday + buffer days)
- Mark core event shifts vs. buffer shifts
- Define shift desirability ratings
- Shift duration: Standard 6h; Executive 8-12h
- Optional 15-minute overlap (configurable/future)
- Desirability guidance: Night=1-2, Sunday=2, Monday=1

### Data Model
```typescript
type ShiftType = 'mobile' | 'stationary' | 'executive'
type ShiftRole = 'team_member' | 'shift_lead' | 'executive'

interface Shift {
  id: string
  type: ShiftType
  startTime: DateTime
  endTime: DateTime
  durationMinutes: number // 360 standard, 480-720 executive
  requiredRoles: ShiftRole[]
  capacity: number
  priority: 'core' | 'buffer'
  desirabilityScore: number // 1-5 scale
  isTemplate?: boolean // future drag/drop templates
}
```

### Priority: **P0 (Critical)**

---

## FR-003: User Profile Management

### User Story
As an administrator, I need to manage team member profiles with experience and demographic tags.

### Requirements
- Pseudonymized identity (alias only)
- Profile attributes:
  - Experience level (junior, intermediate, senior)
  - Gender role (for balance constraints, incl. FLINTA representation)
  - Shift role capabilities
  - Avatar assignment (Unicode emoji cute animals; Emojitwo SVG fallback)
- Manual profile editing by admin only
- Secure alias mapping (separate from main DB)

**Avatar examples (emoji first, Emojitwo SVG fallback):**
🐰 Bunny, 🦦 Otter, 🐿️ Chipmunk, 🦔 Hedgehog, 🐦 Robin, 🦆 Duckling, 🦌 Fawn, 🐱 Kitten  
🦊 Fox, 🦡 Badger, 🦝 Raccoon, 🐼 Panda, 🐨 Koala, 🦉 Owl, 🦚 Peacock, 🦢 Swan, 🦌 Deer, 🐆 Lynx  
🐺 Wolf, 🐻 Bear, 🦅 Eagle, 🦅 Hawk, 🦁 Lion, 🐯 Tiger, 🦅 Falcon, 🐆 Leopard, 🐆 Panther, 🐆 Jaguar

### Data Model
```typescript
interface TeamMember {
  id: string
  alias: string // e.g., "Wolf", "Eagle"
  avatarId: string // Unicode emoji or Emojitwo SVG filename
  experienceLevel: 'junior' | 'intermediate' | 'senior'
  genderRole: string // For balance only
  capabilities: ShiftRole[]
  notes?: string
}
```

### Priority: **P0 (Critical)**

---

## FR-004: Shift Assignment Algorithm

### User Story
As an administrator, I want the system to optimally assign shifts based on preferences and constraints.

### Algorithm Requirements

#### Constraints (Hard)
1. Minimum 2 shifts per person (core event days only: June 26-29)
2. Each shift filled to capacity
3. Shift lead qualification required
4. No person in overlapping shifts
5. Experience balance per team (mix of levels)
6. Gender balance per team (complete 50:50 parity; hard constraint)
7. Buffer period shifts do not count toward minimum shift rule

#### Optimization Goals (Soft)
1. Maximize preference satisfaction
2. Distribute unpopular shifts fairly
3. Balance workload across team members
4. Prioritize core event coverage

#### Scoring System (gender is validated as hard constraint, not weighted)
```typescript
interface AssignmentScore {
  preferenceMatch: number    // 0-100 (higher = better)
  experienceBalance: number  // 0-100 (100 = perfect mix)
  workloadFairness: number   // 0-100 (100 = equal distribution)
  coreShiftCoverage: number  // 0-100 (100 = all filled)
  overall: number           // Weighted average
}
```

#### Weights Configuration
```javascript
const weights = {
  preferenceMatch: 0.35,
  experienceBalance: 0.25,
  workloadFairness: 0.15,
  coreShiftCoverage: 0.05
}
```

### Algorithm Approach
1. **Initialization**: Assign preferred shifts where possible
2. **Constraint Satisfaction**: Fill mandatory requirements
3. **Optimization**: Use weighted scoring for remaining assignments
4. **Random Assignment**: Uncovered shifts assigned randomly from available pool
5. **Validation**: Check all constraints satisfied

### Transparency Requirement
- Explain each assignment decision
- Show constraint violations (if any)
- Display optimization scores
- Allow admin to see alternative assignments

### Priority: **P0 (Critical)**

---

## FR-005: Schedule Visualization

### User Story
As a user, I want to see the shift schedule in an intuitive calendar format.

### Requirements
- **View Modes:**
  - Day view: Detailed shift breakdown
  - Week view: Overview of event period
  - Grid view: Matrix of people x shifts
  
- **Information Display:**
  - Shift times and types
  - Team composition (pseudonyms)
  - Coverage status (filled/unfilled)
  - My assignments highlighted
  
- **Interactions:**
  - Hover for shift details
  - Click for more information
  - Filter by shift type, person, day
  - Responsive design (mobile/tablet/desktop)

### Design Principles (Tailwind)
- Modern, high-end interface with refined aesthetics
- Rich visual hierarchy using gradients and soft shadows
- Color-coded shift types
- Intuitive navigation
- Fast rendering (<1s)

### Priority: **P0 (Critical)**

---

## FR-006: Manual Shift Swaps

### User Story
As an administrator, I need to manually adjust shift assignments.

### Requirements
- View current assignments
- Swap two people's shifts
- Validate swap (constraints still met)
- Log swap with reason
- Rollback capability
- Notification option (future enhancement)

### Validation Rules
- Both people capable of new assignments
- No schedule conflicts created
- Minimum shift counts maintained
- Balance constraints not violated

### Priority: **P1 (High)**

---

## FR-007: PDF Export

### User Story
As an administrator, I want to export schedules to PDF for offline use and printing.

### Requirements
- **Export Options:**
  - Full schedule (all shifts, all people)
  - Personal schedule (individual assignments)
  - Coverage view (unfilled shifts)
  
- **Format:**
  - Professional layout
  - Clear typography
  - Color-coded (print-friendly)
  - Header with event name, dates
  - Footer with generation timestamp
  
- **Pseudonym Handling:**
  - Default: Pseudonyms only
  - Option: Include conversion table
  - Secure conversion process (manual)

### Priority: **P1 (High)**

---

## FR-008: Pseudonym Conversion Table

### User Story
As an administrator, I need to convert pseudonyms to real names for on-site printing.

### Requirements
- Separate secure storage (NOT in main database)
- Manual conversion process
- Generate lookup table as JSON
- Render as formatted PDF
- Clear instructions for secure handling

### Format
```json
{
  "mapping": [
    {"alias": "Wolf", "name": "John Doe"},
    {"alias": "Eagle", "name": "Jane Smith"}
  ],
  "generated": "2025-01-06T12:00:00Z",
  "eventId": "summer-2025"
}
```

### Security Notes
- Keep conversion table offline
- Delete after event
- Password-protected PDF option
- Clear warning about PII handling

### Priority: **P2 (Medium)** (external/offline tool; not in MVP)

---

## FR-009: Audit Trail

### User Story
As an administrator, I want to track all changes for accountability and rollback.

### Requirements
- Log every database mutation:
  - Preference entries
  - Assignment changes
  - Manual swaps
  - Configuration updates
  
- Log Contents:
  - Timestamp
  - Action type
  - User (admin or team member alias)
  - Before/after state
  - Reason (if provided)
  
- Audit Interface:
  - View recent changes
  - Filter by type, user, date
  - Export audit log
  - Rollback capability (future)

### Data Model
```typescript
interface AuditLog {
  id: string
  timestamp: DateTime
  action: AuditAction
  userId: string // Alias
  entityType: 'shift' | 'assignment' | 'profile'
  entityId: string
  before: JSON
  after: JSON
  reason?: string
}
```

### Priority: **P1 (High)**

---

## FR-010: Authentication

### User Story
As an administrator, I want simple protection against unauthorized access.

### Requirements
- Single shared password
- Session-based authentication
- Password entered once per session
- No password recovery (admin-managed)
- Logout capability
- Session timeout (configurable)

### Implementation
```typescript
// Middleware approach
middleware.ts:
  - Check auth cookie
  - Redirect to /login if missing
  - Compare with `ADMIN_PASSWORD`
  
/api/auth/login:
  - Compare password to `ADMIN_PASSWORD`
  - Set HTTP-only cookie `authenticated=true`
  - Redirect to dashboard
```

### Priority: **P0 (Critical)**

---

## FR-011: Configuration Management

### User Story
As an administrator, I want to configure shift rules without code changes.

### Configurable Parameters
- Minimum shifts per person
- Shift desirability scores
- Algorithm weights
- Team composition rules
- Balance thresholds
- Session timeout
- Event dates and times

### Storage
- Database table or JSON config file
- UI for editing (admin only)
- Validation on save
- Version tracking

### Priority: **P2 (Medium)**

---

## FR-012: Coverage Gaps View

### User Story
As an administrator, I want to quickly identify unfilled or understaffed shifts.

### Requirements
- Dashboard view showing:
  - Shifts with no assignments
  - Shifts below capacity
  - Balance constraint violations
  
- Visual indicators:
  - Red: Unfilled
  - Yellow: Understaffed
  - Green: Fully covered and balanced
  
- Quick actions:
  - Re-run algorithm
  - Manual assignment
  - Export gap report

### Priority: **P1 (High)**

---

## Feature Priority Matrix

| Feature | Priority | Complexity | Dependencies | Estimated Effort |
|---------|----------|------------|--------------|------------------|
| FR-001 | P0 | Low | FR-003 | 2 days |
| FR-002 | P0 | Low | - | 1 day |
| FR-003 | P0 | Low | - | 1 day |
| FR-004 | P0 | High | FR-001, FR-002, FR-003 | 5 days |
| FR-005 | P0 | Medium | FR-004 | 3 days |
| FR-006 | P1 | Medium | FR-004, FR-009 | 2 days |
| FR-007 | P1 | Medium | FR-005 | 2 days |
| FR-008 | P2 | Low | FR-007 | 1 day |
| FR-009 | P1 | Medium | - | 2 days |
| FR-010 | P0 | Low | - | 1 day |
| FR-011 | P2 | Low | FR-004 | 1 day |
| FR-012 | P1 | Low | FR-005 | 1 day |

**Total Estimated Effort: ~22 days** (single developer)

---

## Non-Functional Requirements

### Performance
- Page load time: <2 seconds
- Preference entry: <2 minutes total
- Algorithm execution: <10 seconds for 35 people
- PDF generation: <5 seconds

### Usability
- Mobile-first responsive design
- Accessible (WCAG 2.1 Level AA)
- Intuitive navigation
- Clear error messages
- Progressive enhancement

### Reliability
- 95% uptime target
- Database backups: Daily
- Transaction logging: 100% coverage
- Graceful error handling

### Maintainability
- TypeScript for type safety
- Comprehensive code comments
- API documentation
- Deployment documentation
- Test coverage >70%

### Security
- Input validation on all forms
- SQL injection prevention
- XSS protection
- CSRF tokens
- HTTPS in production
- Regular security audits

---

## Future Enhancements (Post-MVP)

### Phase 2
- Email notifications for assignments
- Multi-event management
- Advanced reporting
- Mobile app (React Native)
- Real-time collaboration

### Phase 3
- AI-powered suggestions
- Integration with calendar systems
- Advanced analytics
- Multi-language support
- API for external tools
