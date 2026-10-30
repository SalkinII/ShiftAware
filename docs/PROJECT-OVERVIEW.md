# ShiftAware — Documentation Index

Festival shift planning tool for small teams. Admins build schedules and run allocation; team members vote on preferences and see their assignments.

**Branch:** main | **Status:** v3.12

---

## Documentation Map

| Document                             | Purpose                      | Key Sections                                                                                   |
| ------------------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| [README.md](../README.md)            | Setup & quick start          | Features, Quick Start, Commands                                                                |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design reference      | [Three-Layer Pattern](#), [Environment Lifecycle](#), [File Structure](#), [Error Handling](#)       |
| [DESIGN.md](./DESIGN.md)             | Visual language & components | [Token System](#), [Coordinate System](#), [Component Patterns](#)                             |
| [FRONTEND.md](./FRONTEND.md)         | Frontend patterns reference  | [Coordinate System](#), [Component Registry](#), [Reusability Rules](#), [Prop Conventions](#) |
| [API.md](./API.md)                   | Endpoint reference           | [Auth](./API.md#authentication), [Members](#), [Festivals and environments](#), [Shifts](#), [Algorithm](#)        |
| [ALGORITHM.md](./ALGORITHM.md)       | Allocation engine            | [Phases](#), [Scoring](#), [Rules](#), [Config Mapping](#)                                     |

---

## Key Concepts Glossary

| Term                | Meaning                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **Festival**        | A whole event (e.g. "Starlight Meadow 2026"). Owns the question library and the template library.       |
| **Environment**     | A working area inside a festival (e.g. Bar, Gate, Stage). Shifts, config, team and allocation are scoped to an Environment. |
| **ShiftTemplate**   | Reusable pattern defining lane type, color, capacity. Global (not event-scoped).         |
| **Shift**           | An actual scheduled shift for a specific Environment, derived from a template.                 |
| **Lane**            | Vertical column on the calendar, derived from ShiftTemplate.name.                        |
| **Assignment**      | A TeamMember assigned to a Shift (by algorithm or manually).                             |
| **ShiftPreference** | A member's vote on a shift: `WANT` or `DONT_WANT`.                                       |
| **EnvironmentStatus**     | Lifecycle stage of an event. Determines what operations are permitted.                   |
| **AllocationRule**  | Attribute-based constraint for the algorithm (e.g. "all mobile shifts need first aid").  |
| **RepositoryError** | Typed error from the Repository layer with code: NOT_FOUND / DUPLICATE / DATABASE_ERROR. |

---

## Environment Lifecycle Quick Reference

```
PLANNING ──► OPEN_FOR_PREFERENCES ──► ASSIGNING ──► FINALIZED ──► COMPLETED
    ◄──              ◄──                  ◄──           ◄──
```

| Status               | Who acts | What's possible                           |
| -------------------- | -------- | ----------------------------------------- |
| PLANNING             | Admin    | Create/edit shifts, register members      |
| OPEN_FOR_PREFERENCES | Users    | Vote WANT/DONT_WANT on shifts             |
| ASSIGNING            | Admin    | Run algorithm, preview, manual assignment |
| FINALIZED            | Admin    | Manual reassignment only (dropouts)       |
| COMPLETED            | Nobody   | Read-only (revert to FINALIZED if needed) |

→ Full permission matrix: [ARCHITECTURE.md — Environment Lifecycle](./ARCHITECTURE.md)

---

## Workflow Quick Reference

| Need to…                         | Where to look                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------- |
| Understand system layers         | [ARCHITECTURE.md — Three-Layer Pattern](./ARCHITECTURE.md)                      |
| Find a component file            | [ARCHITECTURE.md — File Structure](./ARCHITECTURE.md)                           |
| Add a new API endpoint           | [ARCHITECTURE.md — Three-Layer Pattern](./ARCHITECTURE.md) + [API.md](./API.md) |
| Change a design token            | [DESIGN.md — Token System](./DESIGN.md) + `app/globals.css`                     |
| Add a new UI component           | [FRONTEND.md — Component Registry](./FRONTEND.md)                               |
| Understand component reuse rules | [FRONTEND.md — Reusability Rules](./FRONTEND.md)                                |
| Understand algorithm config      | [ALGORITHM.md — Config Mapping](./ALGORITHM.md)                                 |
| Debug a route error              | [ARCHITECTURE.md — Error Handling](./ARCHITECTURE.md)                           |
| Add a new lane type              | [DESIGN.md — Quick Reference](./DESIGN.md)                                      |

---

## Quick Debugging Index

**"Lanes not showing"** → Check templates assigned to the environment via EnvironmentTemplate junction. See [ARCHITECTURE.md](./ARCHITECTURE.md).

**"Algorithm returns empty assignments"** → Check EnvironmentRegistration exists for members. The environment must be in ASSIGNING status.

**"RepositoryError not caught in route"** → Add `instanceof RepositoryError` check in catch block. See [ARCHITECTURE.md — Error Handling](./ARCHITECTURE.md).

**"Shifts appear in wrong lane"** → Verify `Shift.templateId` matches a template assigned to the event.

→ Full debugging guide: [ARCHITECTURE.md — Quick Debugging](./ARCHITECTURE.md)
→ Bug register: [docs/Bugs.txt](./Bugs.txt)
