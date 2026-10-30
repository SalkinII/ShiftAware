# Multi-Environment Scoping — Design

> Festival → Environment hierarchy, a shared attribute library, scoped
> environment admins, and a unified entry flow.
> Date: 2026-09-03 | Branch: `feature/multi-environment-scoping`
> Amended: 2026-10-30. Production is wiped before release and starts empty,
> so festivals need a create/edit path (§5a). The runtime moves to Node 24.
> Environment-admin scoping is a UX affordance, not an access control, until
> members have per-member credentials (§7).

---

## 1. Problem

A festival is not one homogeneous work pool. It has distinct working
environments — Bar, Gate, Stage, Infrastructure — each with its own team, its
own shifts, its own tempo, and its own idea of what it needs to know about a
person. ShiftAware currently models only one level: `Event` owns everything, and
the live database confirms an `Event` row is a whole festival
(`Starlight Meadow Festival 2026`, Jun 20–24, 18 shifts, 10 registrations).

Three things follow from that gap:

- There is no way to express "the Bar team" as a unit that plans independently.
- A member joining several environments would re-answer the same profile
  questions once per environment, because `AttributeDefinition` is per-event and
  answers are keyed to the per-event definition row.
- Environment leads cannot be given a scoped view; `isAdmin` comes from a shared
  session password and is all-or-nothing.

## 2. The central insight

The row that today owns shifts, config, algorithm weights, attribute
definitions, registrations, allocation runs and shift-cap scoping is *already*
environment-shaped. It is only named `Event` and lacks a parent.

```
what we want:                    what the code already is:
Festival "Starlight 2026"        (nothing)
└── Environment "Bar"            Event ── owns shifts, config, team,
    ├── shifts                            attributes, allocation, max_shifts
    ├── config / weights
    ├── team + attributes
    └── allocation run
```

So the structural change is **one new parent table plus one FK** — nothing moves
down a level, and the allocation engine is not touched. What remains is a
mechanical rename so the code reads like the domain, and the genuinely new work:
the attribute library, admin scoping, and the entry UX.

### The allocation engine is already correct

`lib/algorithm/types.ts` documents the two maps precisely:

- `memberShifts` — "THIS event only — counts toward maxShiftsPerPerson"
- `crossEventShifts` — "shiftIds from OTHER events — overlap/rest-time checks
  only, never counted toward maxShiftsPerPerson"

That is exactly the required semantics for a person working both Bar and Gate:
no double-booking, rest time respected across environments, but Bar's shift cap
counts only Bar shifts. Delivered by commit `b2b33b6`. **No algorithm changes.**

Verified at the call site rather than assumed: `lib/domain/allocation.ts:82`
seeds cross-environment conflicts with
`where: { teamMemberId: { in: memberIds }, shift: { eventId: { not: eventId } } }`
— a plain "all other events" predicate that the rename carries verbatim. It is
left festival-agnostic: two festivals a year apart cannot overlap in time
anyway, so the existing overlap check already handles it and narrowing the query
buys nothing.

**The shift cap lives in JSON, not in a column.** `maxShiftsPerPerson` is read
from `EnvironmentConfig.balanceThresholds` (`allocation.ts:68`), defaulting to
`Infinity`. The `minShiftsPerPerson` *column* is a different setting and does
not drive the cap. Any test asserting cap behaviour must target
`balanceThresholds.maxShiftsPerPerson`.

## 3. Decisions

| Question | Decision |
|---|---|
| Where does an environment sit? | `Event` **is** the environment; add a `Festival` parent above it. No table is re-scoped. |
| Naming | Mechanically rename `Event` → `Environment` so the code matches the domain. |
| "Unified login" | Auth is unchanged (shared password + `localStorage` member pick). The work is entry routing and switching, not credentials. |
| Shared at festival level | Attribute **definitions** and the shift-template **library**. |
| Per-environment | Which definitions apply (and whether they are required), config, weights, shifts, status, team. |
| Attribute answers | Stored once per member, reused across environments. Asked only if an environment the member joined needs them. |
| Admin | Festival admin sees all. Environment admin is scoped to their registrants and to the definitions their environment requires, as a UX affordance rather than an access control until per-member credentials exist (§7). |
| Data migration | **None.** Local databases are reset and reseeded. Production was wiped on 2026-10-30 and starts empty on the final schema (`migrate deploy` at container start). The demo seed never runs in production. |
| First festival | Created by a global admin in admin setup (§5a). No bootstrap script, no production seed. |
| Runtime | Node 24 (`node:24-slim`, CI `node-version: 24`). Node 20 is end of life and no longer receives security fixes. |

### Explicitly rejected

- **Environment as a new child entity below `Event`.** Would push
  `environmentId` into `Shift`, `ScheduledShift`, `EventConfig`, `PlanMarker`,
  `EventAttributeDefinition` and `EventRegistration`, and re-scope the
  allocation engine. This is the option that breaks the basic logic, for a
  result structurally identical to the chosen one.
- **Per-member credentials.** A separate project; the shared-password model is
  retained deliberately. Without it, environment-admin scoping cannot be an
  access control (§7).
- **`ShiftTemplate.eventId` as "environment-specific template".** The field has
  zero usages outside the schema. A template used by one environment is just a
  library template assigned to one environment via the junction.
- **Sharing config / algorithm weights across environments.** A Bar and a Gate
  want genuinely different weighting; this is already per-event.
- **Backfill migrations, collision guards, conflict resolution for merged
  answers, `EntityType.EVENT` preservation.** All unnecessary given the reset.
  (Diagnostics confirmed it would have been safe anyway: only one event has
  definitions, and zero members answered a same-named question in two events.)
- **URL-based scoping (`/app/[festivalId]/[environmentId]/…`).** Next 15
  supports it cleanly — a nested `layout.tsx` receives `params` as a promise and
  could scope the whole subtree. Rejected anyway: the entire app resolves its
  current event through client context plus `localStorage`, so URL scoping would
  rewrite every route folder and every `fetch` call site for no user-visible
  gain. Context-based scoping is retained; deep-linking to a specific
  environment is not a stated requirement.
- **Festival ↔ environment date-range cross-validation.** `Festival` and
  `Environment` both carry dates, and it is tempting to enforce that an
  environment falls inside its festival's window. Nobody asked for it, festivals
  get extended in practice, and it only creates a way for legitimate edits to be
  blocked. The columns exist; the validation does not.
- **Near-duplicate attribute-name detection (deferred, not cut).** The library
  picker with usage and answer counts is what actually drives reuse, and it
  ships. A similar-name warning on "add new" is belt-and-braces polish; it is
  deferred until the library is observed to rot, and is marked with a
  `ponytail:` comment at the creation site so the deferral stays visible.

## 4. Schema

```prisma
model Festival {                          // NEW
  id        String   @id @default(cuid())
  name      String
  startDate DateTime
  endDate   DateTime

  environments         Environment[]
  attributeDefinitions AttributeDefinition[]
  templateLibrary      ShiftTemplate[]
}

model Environment {                       // was Event
  id         String            @id @default(cuid())
  festivalId String                       // NEW
  festival   Festival          @relation(fields: [festivalId], references: [id], onDelete: Cascade)
  name       String                       // "Bar", "Gate", "Stage"
  startDate  DateTime                     // may narrow the festival window
  endDate    DateTime
  status     EnvironmentStatus @default(PLANNING)

  // all existing Event relations carried over, renamed:
  shifts               Shift[]
  config               EnvironmentConfig?
  scheduledShifts      ScheduledShift[]
  registrations        EnvironmentRegistration[]
  templateAssignments  EnvironmentTemplate[]
  planMarkers          PlanMarker[]
  attributeRequirements EnvironmentAttributeRequirement[]

  @@unique([festivalId, name])
  @@index([festivalId])
}

model AttributeDefinition {               // was EventAttributeDefinition
  id         String        @id @default(cuid())
  festivalId String                       // hoisted from eventId
  festival   Festival      @relation(fields: [festivalId], references: [id], onDelete: Cascade)
  name       String                       // "can_drive"
  label      String                       // "Can Drive"
  type       AttributeType
  options    String[]
  // `required` MOVED to EnvironmentAttributeRequirement

  requirements EnvironmentAttributeRequirement[]
  memberValues TeamMemberAttribute[]

  @@unique([festivalId, name])
  @@index([festivalId])
}

model EnvironmentAttributeRequirement {    // NEW — the junction
  id            String              @id @default(cuid())
  environmentId String
  environment   Environment         @relation(fields: [environmentId], references: [id], onDelete: Cascade)
  definitionId  String
  definition    AttributeDefinition @relation(fields: [definitionId], references: [id], onDelete: Cascade)
  required      Boolean             @default(false)

  @@unique([environmentId, definitionId])
  @@index([environmentId])
  @@index([definitionId])
}

model TeamMemberAttribute {               // UNCHANGED shape
  @@unique([memberId, definitionId])      // answer once, reuse everywhere
}

model EnvironmentRegistration {           // was EventRegistration
  role EnvironmentRole @default(MEMBER)   // NEW
  @@unique([memberId, environmentId])
}

enum EnvironmentRole { MEMBER  ADMIN }    // NEW
```

`required` moving from the definition to the requirement is a deliberate
upgrade, not incidental: Bar can *require* `can_drive` while Gate merely *asks*
for it, using one shared, comparable question.

Renames, for completeness: `EventStatus` → `EnvironmentStatus`,
`EventConfig` → `EnvironmentConfig`, `EventTemplate` → `EnvironmentTemplate`,
`EventRegistration` → `EnvironmentRegistration`, `EntityType.EVENT` →
`EntityType.ENVIRONMENT`, `eventId` → `environmentId` throughout, and
`/api/events/*` → `/api/environments/*`.

### Why one shared definition matters

Comparability. If each environment invents its own question, `can_drive` in Bar
and `hasLicense` in Gate cannot be compared by any heatmap, allocation rule or
distribution view. Environment setup is therefore *picking from a library*, and
"create new" is the last option, with a near-duplicate name warning.

## 5. Unified entry and routing

`/app` becomes the single entry point, resolving a two-level context and routing
on what is already known:

```
/app  ──►  who are you?  ──►  resolve the member's registrations
           (member picker, unchanged)

  0 environments  ──►  Join flow: browse the festival's environments,
                       pick one, answer only what it asks
  1 environment   ──►  straight to your shifts (no picker shown)
  N environments  ──►  environment picker, then your shifts
```

**Resolving the festival.** With more than one festival in the system, entry
must resolve two levels, not one. The rule: registrations are resolved across
*all* festivals, and the routing counts above apply to the member's total
environment registrations regardless of which festival they belong to. A member
with one registration goes straight in even if three festivals exist.

A member may therefore be registered in environments belonging to *different*
festivals, and the UI must answer that unambiguously:

- **The breadcrumb shows the active environment's festival.** There is exactly
  one active environment at a time, so the crumb is always
  `<its festival> › <it>`. Switching to an environment in another festival
  changes both halves of the crumb.
- **`YOUR ENVIRONMENTS` spans festivals** and is grouped by festival, so a
  member sees everything they are part of in one menu without hunting.
- **`JOIN ANOTHER` is likewise grouped by festival.**
- **In both lists the festival heading is suppressed when only one festival is
  represented**, rather than rendered as a redundant single group.

This is the rule the 0/1/N entry-routing tests assert against.

**The member picker is unchanged and remains global.** Identity selection still
lists all `TeamMember` rows, because auth is unchanged and `alias` stays
globally unique. Scoped visibility (§7) governs *admin* views of member data,
not the identity picker. This deliberately does not narrow the existing
impersonation surface — doing so requires per-member credentials, which is out
of scope.

**`Festival` has no status.** It is a named container with a date range; the
lifecycle lives entirely on `Environment`, which is what makes independent
per-environment progress possible.

The 1-environment auto-forward already exists in `EventSelectionStep.tsx`,
guarded by a `sessionStorage` key so navigating *back* does not re-forward. That
guard is preserved; the logic generalises to two levels.

### The switcher is the spine

Today the switcher lives in `Header.tsx` behind `isInAdminSection && events.length > 0`
— admin-only. It moves to the user side and becomes the persistent answer to
"where am I":

```
┌──────────────────────────────────────────────────────┐
│  🎪 Starlight Meadow 2026  ›  Bar ▾        Chris  ▾ │
└──────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴──────────────────────┐
        │  YOUR ENVIRONMENTS                          │
        │  ● Bar        4 shifts · voting open        │
        │  ○ Gate       2 shifts · finalized          │
        │  ─────────────────────────────────────────  │
        │  JOIN ANOTHER                               │
        │  + Stage      needs 2 more questions        │
        └────────────────────────────────────────────┘
```

Three choices, each load-bearing:

1. **Per-environment status is surfaced in the switcher.** With independent
   lifecycles, "voting open in Bar, finalized in Gate" is the single most
   confusing state a member can hit. It must be legible without switching.
2. **Joining lives in the same menu**, not a separate page — growing your
   involvement is one gesture from anywhere in the app.
3. **The join entry pre-declares its cost** ("needs 2 more questions"), so
   nobody is ambushed by a form. The count comes from the same
   requirement-vs-answers resolution the modal uses.

`EventContext` becomes `EnvironmentContext`, holding both levels and exposing
`myEnvironments` separately from `allEnvironments`. `localStorage` keys are
renamed freely (the data is disposable).

## 5a. Festival management and the empty state

Production starts with an empty database, and an `Environment` cannot exist
without a `Festival`. A global admin therefore needs a way to create the first
festival through the app.

**API:**

| Route | Who | Does |
|---|---|---|
| `GET /api/festivals` | any authenticated user | lists festivals: `id`, `name`, `startDate`, `endDate` only |
| `POST /api/festivals` | global admin | creates a festival; audit-logged as `EntityType.FESTIVAL` |
| `PUT /api/festivals/[id]` | global admin | edits name and dates; audit-logged |

All three use the existing `withAuth` + `withErrorHandling` wrappers. A Zod
`createFestivalSchema` requires `name` (non-empty, trimmed), `startDate` and
`endDate`, and rejects `endDate < startDate`. An environment admin (§7) gets
403 on `POST` and `PUT`, because festivals sit above their scope. There is no
`DELETE`: cascading through environments, shifts and answers is risky and
nobody asked for it.

**UI.** Today's `FestivalSettings.tsx` actually edits an `Event`. It splits in two:

- a **festival form**, where you pick an existing festival or create one and
  edit its name and dates;
- an **environment form** scoped to the selected festival, which posts to
  `POST /api/environments` with that festival's `festivalId`.

**Empty state.** With no festival in the database, admin setup opens directly
on "Create your first festival", and members at `/app` see "No festival yet"
rather than an error or an empty picker.

## 6. Attribute library

**Admin — environment setup is picking, not creating:**

```
Set up environment "Bar" — which questions apply?

  Festival question library
  ☑ can_drive        BOOLEAN      · used by Gate, Stage · 9/11 answered   [required ▾]
  ☑ availability     TIME_CONSTR. · used by Gate        · 7/11 answered   [required ▾]
  ☐ gender           SELECT       · used by Stage       · 9/11 answered
  ☐ first_aid        BOOLEAN      · used by Gate        · 4/11 answered
  + Add a new question to the festival library
```

Checking a box creates an `EnvironmentAttributeRequirement`, never a new
definition. Usage and answer counts make reuse the obvious path.

**Member — a strict extension of the existing flow.**
`getMissingAttributes(definitions, values)` in `lib/utils/attribute-check.ts`
already computes the right thing; it is fed *requirements for this environment*
instead of *definitions for this event*. `AttributePromptModal` is unchanged.

The guarantee: joining your second environment asks only for questions that
environment requires **and** you have not already answered. Nobody is asked
their gender unless an environment they joined needs it — data minimisation as a
structural property, not a policy.

## 7. Scoped admin

### Prerequisite: make the repository a real chokepoint

`ARCHITECTURE.md` permits routes to use Prisma directly for business validation,
audit snapshots and analytical utilities. Four routes read members or attributes
that way and would leak past any repository-level guard:

- `app/api/members/route.ts`
- `app/api/members/[id]/route.ts`
- `app/api/conflicts/route.ts`
- `app/api/events/[id]/distribution/heatmap/route.ts`

These move to repository calls **before** scoping is implemented. Without this
step the scoping below is incomplete.

### The rule

What each actor's view shows. Read the caveat below before taking a row as
access control.

| Actor | Sees |
|---|---|
| Festival admin (admin password) | all environments, all members, all attributes |
| Environment admin (`registration.role = ADMIN`) | that environment's registrants only, and only definitions that environment requires |
| Member | own data, plus their environments' shifts |

The requirement filter runs in the repository query, so a view built for an
environment never includes a question that environment does not require. That
shapes responses; it does not decide who may ask for them.

The shared admin password remains the festival-level key. `TeamMember.isAdmin`
stays as-is; environment-level rights come from the registration row.

### What the scoping does not protect

Sign-in and festival-admin checks read signed cookies set at sign-in, so they
are server-side. Neither establishes which member is calling. Environment-admin
scoping is therefore a **UX affordance, not an access control**, until members
have per-member credentials (out of scope, §3):

- The shared password authenticates a session, not a member. A caller with a
  member session can name any member id in a request.
- The registrant-only view applies only when the request carries `X-Member-Id`
  naming an environment admin. Clients send that header, and can omit it or name
  another member. It is a claim, not authentication.
- The requirement filter applies whenever a request names an environment, and any
  caller can name any environment.

So the rule above describes what the app shows, not what a caller may read. These
endpoints return answer values to any authenticated caller. The header changes only
the registrant-only view of the member list, which returns no answers, and a caller
can simply omit it:

| Endpoint | Returns |
|---|---|
| `GET /api/members/[id]/attributes` | every answer the member has given when `environmentId` is omitted; only the environment's required questions when it is given |
| `GET /api/members?environmentId=…` | the listed members with their answers to the environment's required questions; the registrant-only view returns no answers |
| `GET /api/environments/[id]/registrations` | each registrant with their answers to the environment's required questions |
| `GET /api/environments/[id]/distribution/heatmap` | each registrant's answers to the environment's required questions |
| `GET /api/environments/[id]/members/[memberId]/missing-attributes` | the answers for any member to that environment's required questions |
| `GET /api/conflicts` | every member's answers, with no environment scope, used to derive gender-balance suggestions; the response carries the derived conflicts and suggestions, not the answer values |

Writes are open in the same way. `POST /api/members/[id]/attributes` sets an
answer for any member, for any question in the named environment's festival (not
only the ones that environment requires). `POST /api/environments/[id]/registrations`
registers any `memberId`.

Three reads return no answer values: `GET /api/members/[id]` (registrations,
preferences and assignments), `GET /api/members/[id]/joinable-environments` (counts
of missing questions) and `GET /api/festivals/[id]/attribute-definitions` (the
question catalog with usage and answer counts).

Until per-member credentials exist, do not describe any of this as access
control. Making it one needs a caller identity the server resolves itself, which
is the per-member credentials project.

## 8. Execution order

```
0  Bug fixes — AttributeValueField.tsx        (4 fixes from docs/plans/TODO.txt)
1  Schema to final shape, in ONE migration:   (single commit)
     - rename Event → Environment (+ Config, Registration, Template, Status)
     - add Festival parent, Environment.festivalId
     - hoist AttributeDefinition to festivalId, drop its `required`
     - add EnvironmentAttributeRequirement, EnvironmentRole
     - drop ShiftTemplate.eventId → festivalId (library)
   then `prisma migrate reset` + `prisma generate`
2  Code rename to match the schema             (mechanical, gated on tsc)
2a Festival create/edit + empty state (§5a)   (production starts empty)
3  Seed rewrite: 1 festival, 3 environments    (makes the app runnable again, dev only)
4  Attribute library admin UI + member flow    (requirements picker, modal feed)
5  Repository chokepoint for member reads      (prerequisite for 6)
6  Scoped environment admins                   (authorization + security review)
7  Unified entry, routing, switcher            (UX)
8  Docs sync                                   (7 docs reference Event)
```

**Why the schema lands in one migration.** An earlier draft renamed in step 1
and added `Festival` in step 2, but `Environment.festivalId` is non-nullable
with `@@unique([festivalId, name])` — between those two steps there is no
festival for existing rows to point at, and `prisma migrate dev` fails. Since
the database is disposable, the schema goes to its final shape in a single
migration followed by `prisma migrate reset`, and the code rename follows to
match. The reset is an explicit scheduled step, not an implied one.

The seed rewrite moves early (step 3) because after the reset the app has no
data at all; nothing downstream can be exercised by hand until it exists. The
UX stays last because it is the only piece that wants the finished data model
beneath it.

## 9. Testing and verification

Route handlers are thinly covered (105 test files exist, but they concentrate on
the algorithm, lanes, export and components). So the rename's proof is **not**
"vitest is green":

- `tsc --noEmit` — add as a `typecheck` npm script. This is the rename's real
  gate; a mechanical rename either type-checks or it does not.
- `npm test` — the 105 existing test files, as a regression net.
- `tests/e2e/critical-flows.spec.ts` — Playwright smoke gate after the reset and
  reseed, confirming login → identity → calendar still works end to end.

New tests, where they earn their keep:

| Area | Test |
|---|---|
| Requirement resolution | given environment requirements + a member's existing answers, the correct missing set is returned (including "nothing missing" on second join) |
| Scoped visibility | an environment admin's member query excludes non-registrants, and excludes attribute values for definitions their environment does not require. It asserts the response shape for a request that names an admin; it does not prove access control (§7) |
| Entry routing | 0 / 1 / N registrations each route correctly; the back-navigation guard still suppresses re-forwarding |
| Cross-environment allocation | a member in two environments is not double-booked, and each environment's shift cap counts only its own shifts (guards the existing behaviour through the rename) |
| Festival validation | `createFestivalSchema` rejects an empty name and `endDate < startDate`, and accepts a one-day festival |
| Festival authorization | `POST /api/festivals` returns 403 for a member and for an environment admin, and 201 plus an audit entry for a global admin |
| Empty state | with zero festivals, admin setup renders "Create your first festival" and `/app` renders "No festival yet" |
| First run (e2e) | on an empty database with no seed: the admin creates a festival and an environment, then a member joins and answers the required attributes, then the admin sees that member |

## 10. Risks

| Risk | Mitigation |
|---|---|
| Rename touches route folders and every `fetch` call site at once | Single atomic commit; `tsc --noEmit` gate. Note: reverting the rename alone stops being meaningful once step 1's reset has run — before that point it is a clean revert, after it the schema and code must move together |
| Scoped-admin view silently incomplete if a direct-Prisma site is missed | Step 4 is an explicit prerequisite listing all four sites; the scoped-visibility test asserts the response shape |
| Independent per-environment statuses confuse members | Status is surfaced in the switcher for every environment, not just the active one |
| Attribute library rots into near-duplicates | "Add new" is the last option and warns on similar names; usage counts make reuse visibly preferable |
| Docs drift (7 files say "Event") | Step 8 is explicit; `PROJECT-OVERVIEW.md` glossary and `ARCHITECTURE.md` are the load-bearing ones |
| Empty production database can't create a festival, so no environment can exist | §5a festival form and empty state; the first-run e2e test runs without a seed |

## 11. Deferred

- **Audit-log PII retention.** `AuditLog.ipAddress` and the full `before`/`after`
  snapshots are kept indefinitely. A retention period and pruning job are a
  separate piece of work.
