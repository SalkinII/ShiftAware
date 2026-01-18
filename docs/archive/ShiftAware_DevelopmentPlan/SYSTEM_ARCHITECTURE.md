# System Architecture

**Status:** Phase 0 scaffold in place (Prisma schema + seed, auth, port palette). Application services, shift/preference APIs, assignment engine, dashboards, and exports remain to be built (Phase 1+).

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Next.js Frontend (React)                   │ │
│  │  - Tailwind CSS styling                                │ │
│  │  - Client-side state management                        │ │
│  │  - PDF generation                                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js Application Server (Node.js)           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                   API Routes                            │ │
│  │  /api/auth/* - Authentication                          │ │
│  │  /api/shifts/* - Shift management                      │ │
│  │  /api/preferences/* - Preference handling              │ │
│  │  /api/assignments/* - Assignment logic                 │ │
│  │  /api/export/* - PDF generation                        │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │            Business Logic Layer                         │ │
│  │  - Algorithm engine                                    │ │
│  │  - Validation rules                                    │ │
│  │  - Audit logging                                       │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                 Prisma ORM                              │ │
│  │  - Type-safe queries                                   │ │
│  │  - Migration management                                │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │ TCP
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                        │
│  - Persistent data storage                                  │
│  - ACID transactions                                        │
│  - Audit trail                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Application Layers

### 1. Presentation Layer (Client-Side)
**Technology:** Next.js React Components + Tailwind CSS

**Responsibilities:**
- Render UI components
- Handle user interactions
- Client-side validation
- State management (React Context)
- PDF generation (client-side)

**Key Components:**
- `Calendar` - Schedule visualization
- `PreferenceForm` - Shift selection interface
- `AssignmentView` - Final schedule display
- `AdminPanel` - Admin controls
- `ExportButton` - PDF generation trigger

### 2. API Layer (Server-Side)
**Technology:** Next.js API Routes

**Endpoints:**
```
POST   /api/auth/login              - Authenticate user
POST   /api/auth/logout             - End session
GET    /api/shifts                  - List all shifts
POST   /api/shifts                  - Create shift (admin)
PUT    /api/shifts/:id              - Update shift (admin)
GET    /api/preferences/mine        - Get user preferences
POST   /api/preferences             - Submit preferences
POST   /api/assignments/run         - Execute algorithm (admin)
GET    /api/assignments             - Get all assignments
POST   /api/assignments/swap        - Manual swap (admin)
GET    /api/members                 - List team members (admin)
POST   /api/members                 - Create member (admin)
GET    /api/audit                   - View audit log (admin)
POST   /api/export/pdf              - Generate PDF
```

### 3. Business Logic Layer
**Location:** `/lib/` directory

**Modules:**
- `algorithm/` - Assignment algorithm
  - `scorer.ts` - Scoring functions
  - `optimizer.ts` - Constraint satisfaction
  - `validator.ts` - Constraint checking
  - `explainer.ts` - Decision explanations

- `services/` - Business services
  - `shiftService.ts` - Shift operations
  - `assignmentService.ts` - Assignment management
  - `auditService.ts` - Audit logging
  - `exportService.ts` - Export generation

- `utils/` - Helper functions
  - `dateUtils.ts` - Date handling
  - `validation.ts` - Input validation
  - `balance.ts` - Balance calculations

### 4. Data Access Layer
**Technology:** Prisma ORM

**Responsibilities:**
- Database queries
- Transaction management
- Migration execution
- Type generation

### 5. Database Layer
**Technology:** PostgreSQL

**Responsibilities:**
- Data persistence
- ACID transactions
- Constraint enforcement
- Backup/restore

---

## Component Architecture

**Design source of truth:** Follow the modern design system (`.context/260106_DESIGN_SYSTEM_1.md`) for palette/typography/spacing and the high-end UI spec (`.context/UI_SPECIFICATION_1.md`) for app shell, login/dashboard, timeline, preferences, and admin views.

### Page Components
```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx               # Login page
│   └── layout.tsx                 # Auth layout wrapper
├── dashboard/
│   └── page.tsx                   # Main dashboard
├── preferences/
│   └── page.tsx                   # Preference entry
├── schedule/
│   └── page.tsx                   # Schedule view
└── admin/
    ├── members/page.tsx           # Member management
    ├── shifts/page.tsx            # Shift config
    ├── assignments/page.tsx       # Assignment controls
    └── audit/page.tsx             # Audit log viewer
```

### Shared Components
```
components/
├── ui/                            # Base UI components
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── Select.tsx
│   └── Modal.tsx
├── features/                      # Feature components
│   ├── Calendar/
│   │   ├── CalendarView.tsx
│   │   ├── DayView.tsx
│   │   ├── WeekView.tsx
│   │   └── ShiftCard.tsx
│   ├── Preferences/
│   │   ├── PreferenceForm.tsx
│   │   └── ShiftSelector.tsx
│   ├── Assignments/
│   │   ├── AssignmentList.tsx
│   │   ├── CoverageIndicator.tsx
│   │   └── BalanceMetrics.tsx
│   └── Export/
│       ├── PDFExport.tsx
│       └── ExportOptions.tsx
└── layout/                        # Layout components
    ├── Header.tsx
    ├── Sidebar.tsx
    └── Footer.tsx
```

---

## Data Flow Patterns

### 1. Preference Submission Flow
```
User → PreferenceForm → POST /api/preferences 
  → Validate input → Save to DB → Audit log 
  → Return confirmation → Update UI
```

### 2. Assignment Algorithm Flow
```
Admin → Trigger algorithm → POST /api/assignments/run
  → Load preferences → Load constraints → Load team data
  → Run algorithm → Generate scores → Validate constraints
  → Save assignments → Audit log → Return results
  → Update dashboard
```

### 3. Manual Swap Flow
```
Admin → Select swap → POST /api/assignments/swap
  → Validate swap (constraints) → Update DB records
  → Audit log → Recalculate balance metrics
  → Return updated schedule → Refresh UI
```

### 4. PDF Export Flow
```
User → Export button → Fetch assignment data (API)
  → Generate PDF (client-side) → Browser download
```

---

## Authentication Flow

```
1. User → /login page
2. Enter password → POST /api/auth/login
3. Server: Compare password with `ADMIN_PASSWORD`
4. Match? Set HTTP-only cookie `authenticated=true`
5. Redirect to /dashboard
6. Middleware checks cookie on each request
7. Invalid/expired? Redirect to /login
```

**Session Management:**
- HTTP-only cookies (prevent XSS)
- Secure flag in production (HTTPS only)
- SameSite=Lax (CSRF protection)
- Configurable timeout via `SESSION_TIMEOUT_MINUTES` (default 60)
- No server-side session store (low-risk scope)

---

## Algorithm Architecture

### Assignment Algorithm Pipeline

```
┌─────────────────────────────────────────────────────────┐
│           1. INITIALIZATION PHASE                       │
│  - Load all shifts                                      │
│  - Load all team members                                │
│  - Load all preferences                                 │
│  - Load configuration (weights, thresholds)             │
└─────────────────────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────┐
│        2. HARD CONSTRAINT VALIDATION                    │
│  - Check min shifts per person possible                 │
│  - Verify shift capacities achievable                   │
│  - Validate role requirements can be met                │
│  - Enforce gender balance as a hard constraint (50:50)  │
└─────────────────────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────┐
│           3. PREFERENCE MATCHING                        │
│  For each shift with preferences:                       │
│    - Sort by preference priority                        │
│    - Assign if constraints satisfied                    │
│    - Update availability tracking                       │
└─────────────────────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────┐
│        4. OPTIMIZATION PHASE                            │
│  For remaining unfilled slots:                          │
│    - Calculate weighted scores for each person          │
│    - Select best fit considering:                       │
│      * Workload balance                                 │
│      * Experience distribution                          │
│      * Gender balance                                   │
│      * Shift desirability fairness                      │
└─────────────────────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────┐
│         5. RANDOM ASSIGNMENT                            │
│  For any still-unfilled slots:                          │
│    - Filter available people                            │
│    - Random selection from eligible pool                │
│    - Update assignments                                 │
└─────────────────────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────┐
│          6. VALIDATION & LOGGING                        │
│  - Verify all constraints met                           │
│  - Calculate final balance metrics                      │
│  - Generate explanation for each assignment             │
│  - Log algorithm run to audit trail                     │
│  - Return results with scores                           │
└─────────────────────────────────────────────────────────┘
```

### Scoring Function Detail

```typescript
function scoreAssignment(
  person: TeamMember,
  shift: Shift,
  currentState: AssignmentState
): Score {
  const scores = {
    preference: calculatePreferenceScore(person, shift),
    workload: calculateWorkloadScore(person, currentState),
    experience: calculateExperienceScore(person, shift, currentState),
    desirability: calculateDesirabilityScore(person, currentState)
  };
  
  const weighted = 
    scores.preference * weights.preferenceMatch +
    scores.workload * weights.workloadFairness +
    scores.experience * weights.experienceBalance +
    scores.desirability * 0.1;
  
  return { overall: weighted, breakdown: scores };
}
```

---

## Security Architecture

### Defense Layers

1. **Network Layer**
   - HTTPS in production
   - CORS configuration
   - Rate limiting (optional)

2. **Application Layer**
   - Input validation (Zod schemas)
   - Output sanitization
   - CSRF tokens (Next.js built-in)
   - SQL injection prevention (Prisma)

3. **Authentication Layer**
   - Plain `ADMIN_PASSWORD` comparison (low-risk scope)
   - Simple `authenticated=true` cookie
   - HTTP-only cookies
   - Secure cookie flags

4. **Data Layer**
   - Pseudonymization
   - Audit logging
   - Backup encryption
   - No PII storage

### Threat Model

| Threat | Mitigation | Priority |
|--------|-----------|----------|
| Unauthorized access | Basic auth + session | High |
| XSS attacks | React auto-escaping | Medium |
| SQL injection | Prisma parameterization | High |
| CSRF | Built-in tokens | Medium |
| Data leakage | Pseudonymization | High |
| DoS | Rate limiting (future) | Low |

---

## Deployment Architecture

### Environment Configuration (placeholders)
- `DATABASE_URL` (Postgres connection)
- `ADMIN_PASSWORD` (plain password)
- `SESSION_TIMEOUT_MINUTES` (default 60)
- `STORAGE_BUCKET_URL` (for PDF exports)
- Host port palette (host→container): app `43000→3000`, postgres `45432→5432`, optional python `43010→8000`

### Port Palette (host → container)
| Service | Host Port | Container Port | Notes |
|---------|-----------|----------------|-------|
| Next.js app | 43000 | 3000 | Avoids conflicts with other projects using 3000/3005 |
| PostgreSQL | 45432 | 5432 | Host-exposed for local tools; keep container at 5432 |
| Python compute (optional) | 43010 | 8000 | Only if the FastAPI proto is enabled |

> If a host port is busy, change the **host** side in compose overrides; keep container ports unchanged.

### Container Structure

```dockerfile
# Dockerfile (multi-stage build)

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production

# Copy necessary files
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Run migrations and start
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
```

### Docker Compose (Development)

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "43000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/shiftaware
      - NODE_ENV=development
    depends_on:
      - db
    volumes:
      - .:/app
      - /app/node_modules

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=shiftaware
    ports:
      - "45432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Optional service:** if using the Python compute prototype, expose it as `43010:8000` and reference it via service name (`python-compute:8000`) from other containers.

### Production Deployment

**Cloud-hosted container (target)**
- Run app container on ECS/Cloud Run/ACI
- Managed PostgreSQL (RDS/Cloud SQL)
- Object storage for exports (S3/Cloud Storage)
- HTTPS via managed LB/ingress
- Backups via managed DB + bucket lifecycle

**Simple Compose (alt)**
- Single host with Nginx reverse proxy
- Cron-based backups to object storage

---

## Monitoring & Observability

### Logging Strategy
- Application logs: stdout/stderr
- Audit logs: Database
- Error logs: File + monitoring service
- Access logs: Nginx (production)

### Metrics to Track
- Request latency
- Error rate
- Database query performance
- Algorithm execution time
- Active sessions
- PDF generation time

### Health Checks
```
GET /api/health
Response: {
  status: "ok",
  database: "connected",
  uptime: 3600,
  version: "1.0.0"
}
```

---

## Scalability Considerations

### Current Architecture Supports:
- **Users:** 25-35 (current), 100-500 (with same architecture)
- **Concurrent users:** 50+
- **Shifts per event:** Unlimited
- **Events:** Multiple simultaneous

### Scaling Paths:
1. **Vertical:** Increase container resources
2. **Horizontal:** Multiple app instances (stateless design)
3. **Database:** Read replicas, connection pooling
4. **Caching:** Redis for sessions and frequent queries
5. **CDN:** Static assets (if needed)

### When to Scale:
- Response time >3s consistently
- Database connections maxed out
- Memory usage >80% consistently
- User base >500
