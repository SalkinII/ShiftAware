# Technology Stack & Design Philosophy

## Core Stack

### Frontend Framework: **Next.js 14+**
**Rationale:**
- Server-side rendering for fast initial loads
- API routes eliminate need for separate backend
- File-based routing for maintainability
- React 18+ features (Server Components)
- Strong TypeScript support
- Active community and documentation

**Alternatives Considered:**
- SvelteKit: Less ecosystem maturity
- Vite + React: More setup complexity
- Remix: Smaller ecosystem

### Styling: **Tailwind CSS v4**
**Philosophy - Utility-First Approach:**

Tailwind's utility-first methodology aligns perfectly with this project's goals:

**Benefits for ShiftAware:**
1. **Rapid Prototyping**: Build UI directly in markup without CSS context switching
2. **Design Consistency**: Constrained design tokens prevent arbitrary values
3. **No CSS Growth**: CSS bundle size stays constant as features grow
4. **Component Clarity**: Styling visible directly in JSX
5. **Maintainability**: Changes isolated to specific elements
6. **Responsive Design**: Breakpoint prefixes (sm:, md:, lg:) in markup
7. **Dark Mode**: Simple dark: prefix if needed

**Core Principles Applied:**
- Composable single-purpose classes (`flex items-center gap-4`)
- Design tokens over magic numbers (spacing scale, color palette)
- Variants for states (`hover:bg-blue-600 focus:ring-2`)
- Minimal custom CSS (only for truly unique patterns)
- Component extraction for repetition (3+ identical patterns)

**Implementation Strategy:**
```javascript
// tailwind.config.ts - Custom design tokens
theme: {
  extend: {
    colors: {
      'shift-primary': '#...',
      'shift-accent': '#...',
    },
    spacing: {
      'schedule-cell': '4rem',
    }
  }
}
```

### Database: **PostgreSQL**
**Rationale:**
- ACID compliance for audit trail
- JSON support for flexible metadata
- Robust backup/restore capabilities
- Well-understood by operations teams
- Excellent Docker support

**Alternatives:**
- SQLite: Limited concurrent writes
- MySQL: Less feature-rich than Postgres
- MongoDB: Overkill for relational data

### ORM: **Prisma**
**Rationale:**
- Type-safe database queries
- Migration management
- Excellent developer experience
- Auto-generated TypeScript types
- Schema as source of truth

### Authentication: **Custom Basic Auth Middleware**
**Rationale:**
- Project requires single-password protection
- No user management complexity
- Minimal attack surface
- Easy to implement and audit

**Configuration:**
- Password stored as plain env (`ADMIN_PASSWORD`) and compared directly (low-risk scope)
- Admin updates `ADMIN_PASSWORD` in env and restarts the app
- Session timeout 60 minutes (configurable)

**NOT using:**
- NextAuth.js: Overengineered for single password
- Clerk/Auth0: External dependencies
- JWT: Unnecessary complexity

### Container Runtime: **Docker**
**Rationale:**
- Standard deployment format
- Environment isolation
- Easy local development
- GitHub Container Registry support

---

## Supporting Libraries

### Avatar System
- Primary: Native Unicode emoji (cute animal set)
- Fallback: Emojitwo SVG (CC-BY 4.0, https://emojitwo.github.io/)
- Attribution required when using Emojitwo assets

### PDF Generation: **react-pdf/renderer** or **jsPDF**
- Client-side PDF generation
- Schedule export functionality
- No server-side dependencies

### Date Handling: **date-fns**
- Lightweight (vs moment.js)
- Tree-shakeable
- Immutable API

### Form Validation: **Zod**
- Runtime type validation
- Integrates with TypeScript
- Schema-based validation
- Works with Prisma schemas

### State Management: **React Context + Hooks**
- Built-in React features
- No external dependencies
- Sufficient for application complexity

**NOT using:**
- Redux: Overkill for this scale
- Zustand/Jotai: Unnecessary dependency

---

## Development Tools

### Language: **TypeScript**
- Type safety prevents runtime errors
- Better IDE support
- Self-documenting code
- Prisma integration

### Code Quality:
- **ESLint**: Linting
- **Prettier**: Formatting (with Tailwind plugin)
- **Husky**: Pre-commit hooks
- **TypeScript Strict Mode**: Maximum type safety

### Testing:
- **Vitest**: Fast unit tests
- **Playwright**: E2E testing
- **React Testing Library**: Component tests

### Version Control:
- **Git**: Source control
- **GitHub**: Repository + Actions CI/CD
- **Conventional Commits**: Structured commit messages

---

## Architecture Patterns

### Design Patterns:
1. **Component-Driven Development**: Reusable UI components
2. **Composition over Inheritance**: Flexible component composition
3. **Separation of Concerns**: Presentation / Logic / Data layers
4. **Configuration over Code**: Externalize shift rules, weights
5. **Fail-Fast**: Early validation, clear error messages

### Code Organization:
```
app/
├── (auth)/          # Auth-protected routes
├── api/             # API endpoints
├── components/      # Reusable UI components
│   ├── ui/         # Base UI primitives
│   └── features/   # Feature-specific components
├── lib/            # Utilities and helpers
│   ├── db/        # Database utilities
│   ├── algorithm/ # Shift assignment logic
│   └── utils/     # General utilities
└── types/          # TypeScript types

prisma/
├── schema.prisma   # Database schema
└── migrations/     # Migration files
```

### Styling Strategy:
1. **Utility-First**: Tailwind utilities for 90% of styling
2. **Component Extraction**: Reusable patterns → components
3. **Custom CSS**: Only for complex animations or unique layouts
4. **Design Tokens**: Centralized in `tailwind.config.ts`

---

## Deployment Architecture

### Container Structure:
```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder
# Build Next.js app

FROM node:20-alpine AS runner
# Production runtime
# Run migrations on startup
# Start Next.js server
```

### Services:
1. **Next.js App**: Port 3000
2. **PostgreSQL**: Port 5432 (internal)
3. **Object Storage**: Cloud bucket for exports (S3/Cloud Storage)

### Environment Configuration:
- `.env.local`: Local development
- `.env.production`: Production secrets
- Docker secrets for sensitive data
- Key vars: `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_TIMEOUT_MINUTES`, `STORAGE_BUCKET_URL`

---

## Performance Considerations

### Optimization Strategies:
1. **Static Generation**: Pre-render static pages
2. **Image Optimization**: Next.js Image component
3. **Code Splitting**: Automatic via Next.js
4. **CSS Purging**: Tailwind removes unused utilities
5. **Database Indexing**: Key columns indexed
6. **Caching**: API response caching where appropriate

### Bundle Size Goals:
- Initial JS: <100KB gzipped
- CSS: <10KB (Tailwind purged)
- Total page weight: <500KB

---

## Scalability Notes

While built for 25-35 users, architecture supports:
- **User Scale**: Up to 500 users without changes
- **Shift Scale**: Unlimited shifts per period
- **Concurrent Users**: 50+ simultaneous connections
- **Horizontal Scaling**: Stateless app layer

---

## Security Boundaries

### Threat Model:
- **Low-Risk Environment**: No sensitive personal data
- **Primary Threat**: Unauthorized schedule access
- **Secondary Threat**: Data integrity issues

### Security Measures:
1. Basic authentication (single password)
2. HTTPS in production (reverse proxy)
3. SQL injection prevention (Prisma parameterization)
4. XSS prevention (React auto-escaping)
5. CSRF tokens (Next.js built-in)
6. Input validation (Zod schemas)
7. Audit logging (all mutations)

### Data Protection:
- No PII in database
- Pseudonym mapping stored separately
- Transaction logs for forensics
- Regular automated backups

---

## Technology Decision Log

| Decision | Rationale | Alternatives | Date |
|----------|-----------|--------------|------|
| Next.js 14 | SSR, API routes, mature ecosystem | SvelteKit, Remix | 2025-01-06 |
| Tailwind CSS v4 | Utility-first philosophy, rapid development | CSS Modules, Styled Components | 2025-01-06 |
| PostgreSQL | ACID compliance, robustness | SQLite, MySQL | 2025-01-06 |
| Prisma | Type safety, migrations | Drizzle, raw SQL | 2025-01-06 |
| TypeScript | Type safety, better DX | JavaScript | 2025-01-06 |
| Docker | Standard deployment | Native, Kubernetes | 2025-01-06 |

---

## Future Considerations

### Potential Enhancements:
- WebSocket for real-time updates (if needed)
- Redis caching layer (if performance issues)
- Monitoring (Sentry for errors, Prometheus for metrics)
- Advanced scheduling algorithms (ML-based)
- Multi-language support (i18n)

### Migration Paths:
- Scale to dedicated backend (NestJS, Express)
- Move to microservices (unlikely needed)
- Add mobile apps (React Native)
- Cloud deployment (AWS ECS, GCP Cloud Run)
