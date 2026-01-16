# Setup Guide

## Phase 1: Database & Infrastructure Setup

### Prerequisites

- Docker Desktop installed and running
- Node.js 20+ installed
- PostgreSQL client (psql) installed (optional, for manual migrations)

### Step 1: Environment Variables

Create a `.env` file in the root directory (copy from `.env.example`):

```bash
# Database Connection
# PostgreSQL container exposes port 5433 on host -> 5432 in container
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/appdb
# Alternative: connect via Docker network (when running in Docker)
# DATABASE_URL=postgresql://postgres:postgres@db:5432/appdb

# Authentication
# Generate hash with: npm run generate-hash <your_password>
# Example: npm run generate-hash mypassword123
# IMPORTANT: Always quote bcrypt hashes (they start with $ which dotenv interprets as variables)
ADMIN_PASSWORD_HASH="$2a$10$..."  # Replace with your generated hash, keep the quotes!

# Application
NODE_ENV=development
PORT=3005
NEXT_PUBLIC_APP_URL=http://localhost:3005

# Session
SESSION_SECRET=change_this_to_random_string_in_production
```

### Step 2: Start Docker Containers

**Using Existing PostgreSQL Container:**

We're using the existing PostgreSQL container from your `general_prototyping_repo` project. Ensure it's running:

```bash
# Check if containers are running
docker ps

# If PostgreSQL container is not running, start it:
docker start e065a4cb5f9c0d63ae3f715f21ca30749d16ae4eedc565c15ae1edb27a8a0628

# Verify it's healthy
docker ps | grep e065a4cb5f9c0d63ae3f715f21ca30749d16ae4eedc565c15ae1edb27a8a0628
```

The PostgreSQL container details:
- **Container**: `general_prototyping_repo-db-1` (alias: `db`)
- **Database**: `appdb`
- **User**: `postgres`
- **Password**: `postgres`
- **Network**: `general_prototyping_repo_default`

**Exposing PostgreSQL Port to Host (Optional):**

If you need to connect to PostgreSQL from your host machine (for migrations, database tools, etc.), you can expose port 5432:

**Note:** The PostgreSQL container is already configured with port mapping:
- **Host port**: `5433` (accessible from your machine)
- **Container port**: `5432` (internal PostgreSQL port)
- **Connection string**: `postgresql://postgres:postgres@localhost:5433/appdb`

If you need to recreate the container with port mapping:
```powershell
# Remove old container
docker rm general_prototyping_repo-db-1

# Recreate with port mapping (preserves data volume)
docker run -d `
  --name general_prototyping_repo-db-1 `
  --network general_prototyping_repo_default `
  --network-alias db `
  -p 5433:5432 `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=appdb `
  -e POSTGRES_USER=postgres `
  -v general_prototyping_repo_postgres_data:/var/lib/postgresql/data `
  postgres:16-alpine
```

Our app will connect to this existing PostgreSQL instance.

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Run Database Migration

```bash
npm run migrate
```

Or manually:

```bash
psql $DATABASE_URL -f migrations/001_initial_schema.sql
```

### Step 5: Test Database Connection

```bash
npm run test:db
```

This should output:
- ✓ Database connection successful
- ✓ All tables exist
- Row counts for each table

### Step 6: Start Development Server

```bash
npm run dev
```

The app will be available at http://localhost:3005

## Troubleshooting

- **Database connection fails**: 
  - Check that PostgreSQL container is running (`docker ps | grep general_prototyping_repo-db-1`)
  - Verify port mapping: `docker port general_prototyping_repo-db-1` (should show 5433->5432)
  - Use connection string: `postgresql://postgres:postgres@localhost:5433/appdb`
  - If connecting from Docker container, use: `postgresql://postgres:postgres@db:5432/appdb`
- **Port 3005 already in use**: Change PORT in `.env` file
- **Migration fails**: 
  - Ensure database `appdb` exists (it should, from the existing container)
  - Verify user `postgres` has proper permissions
  - Check network connectivity if running in Docker
- **Network connection issues**: Ensure ShiftAware app container is on `general_prototyping_repo_default` network

