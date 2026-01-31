# ShiftAware

Open-source shift planning for small festival teams (25-35 people).

## Features

- **Lane Calendar View** - Visual drag-drop shift planning with snap-to-previous behavior
- **Role-Based Access** - Admin (full control) and User (view & vote) roles
- **Identity Selection** - Honor-based team member identification
- **Preference Voting** - Users vote on shift preferences before assignment
- **Fair Allocation** - Algorithm balances fairness, preferences, and constraints
- **PNG Export** - Download personal or full schedule as timestamped images

## Pages

### Admin
| Page | Path | Purpose |
|------|------|---------|
| Setup | `/admin/setup` | Event config, shift templates, team attributes |
| Schedule | `/admin/shifts/schedule` | Drag-drop shift planning with LaneCalendarView |
| Team | `/admin/team` | Member management and allocation |
| Audit | `/admin/audit` | Change history with rollback |

### User
| Page | Path | Purpose |
|------|------|---------|
| Identity | `/app/identity` | Select your identity (every login) |
| Calendar | `/app/calendar` | View shifts, vote preferences, request swaps |
| Export | `/app/export` | Download schedule as PNG |

## Quick Start

```bash
# Install dependencies
npm install

# Set up database
docker compose up db -d
npx prisma migrate dev

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL + Prisma
- **UI:** Tailwind CSS + shadcn/ui
- **Drag & Drop:** dnd-kit
- **Testing:** Vitest + Playwright

## License

Apache 2.0
