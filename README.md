# Kernabase

A self-hosted Postgres database with a Supabase Studio-like web UI: table editor (browse/insert/edit/delete rows), a table creator, and a SQL editor with syntax highlighting.

The backend includes JWT authentication, per-project credentials, bounded tenant connection pools,
request throttling, health probes, and production safety limits.

## Stack

- **Database**: plain `postgres:16-alpine` via Docker Compose (not the Supabase image).
- **Backend**: NestJS + TypeScript + `pg`, exposing a REST API generated from your schema (introspects `information_schema` at request time, so new tables/columns show up automatically). DTOs validated with `class-validator`.
- **Frontend**: React + TypeScript (Vite), Tailwind CSS, a CodeMirror-based SQL editor, and toast notifications instead of `alert()`.

## Run it

Three pieces, each in its own terminal:

```bash
# 1. Database
cd kernabase
docker compose up -d              # Postgres on localhost:55432

# 2. Backend (NestJS API)
cd backend
npm install
npm run start:dev                 # http://localhost:3001/api

# 3. Frontend (React)
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

Open http://localhost:5173. The Vite dev server proxies `/api/*` to the backend on port 3001, so no CORS setup is needed in dev. Use "+ New table" to create a table, or the SQL Editor tab to run arbitrary SQL (including `CREATE TABLE` statements, Ctrl/Cmd+Enter to run).

## Config

Backend reads standard `PG*` env vars (defaults match `docker-compose.yml`):

- `PGHOST` (localhost), `PGPORT` (55432), `PGUSER` (postgres), `PGPASSWORD` (postgres), `PGDATABASE` (mydb), `PORT` (3001, the API's own port).

Production-sensitive settings:

- `STUDIO_JWT_SECRET` and `STUDIO_SECRET` are mandatory in production.
- `CORS_ORIGINS` is a comma-separated allow-list (default `http://localhost:5173`).
- `TENANT_POOL_CONNECTION_BUDGET` is the per-backend-replica connection budget. Size it across all replicas, preferably behind PgBouncer.
- `TENANT_STATEMENT_TIMEOUT_MS` defaults to 15 seconds.
- `SQL_MAX_ROWS` and `SQL_MAX_RESPONSE_BYTES` default to 10,000 rows and 5 MB.
- `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`, and `RATE_LIMIT_WINDOW_MS` control per-instance throttling. Use a gateway or shared Redis limiter when exact cluster-wide limits are required.
- `HTTP_BODY_LIMIT` defaults to `1mb`.

Operational endpoints are `/api/health/live`, `/api/health/ready`, and
`/api/health/metrics` (Prometheus text format). The backend handles termination signals and drains
database pools during graceful shutdown.

For large tables, row browsing supports keyset pagination with `cursor=<nextCursor>` and can skip
the expensive exact count using `includeTotal=false`. Offset pagination remains available for the UI.

To run the database and production backend containers, set two strong, independent secrets first:

```bash
export STUDIO_JWT_SECRET='replace-with-a-long-random-value'
export STUDIO_SECRET='replace-with-another-long-random-value'
docker compose up --build
```

## Notes / limitations

- The SQL editor intentionally permits arbitrary SQL for an authenticated project owner. Queries are time- and response-bounded, but production deployments should still isolate tenant database roles and networks.
- Row edit/delete require the table to have a primary key.
- "Insert row" inserts using column defaults (`DEFAULT VALUES`); double-click a cell afterward to edit it in the grid.
- Supported column types in the table creator: text, varchar, integer, bigint, smallint, numeric, real, double precision, boolean, date, timestamp, timestamptz, uuid, jsonb, json.

## Project layout

```
kernabase/
  docker-compose.yml   # Postgres only
  backend/             # NestJS API (TypeScript)
    src/
      db/              # pg Pool wrapper, identifier quoting
      tables/          # table CRUD + schema introspection
      sql/             # raw SQL runner (SQL editor backend)
  frontend/            # React + TypeScript (Vite)
    src/
      components/      # Sidebar, TableEditor, DataGrid, SqlEditor, NewTableModal, Toast
      lib/api.ts        # typed fetch client
```
