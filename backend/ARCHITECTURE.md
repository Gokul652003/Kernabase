# Backend architecture

The backend is a modular monolith. Each feature owns its HTTP adapter, application service,
DTOs, and types. Cross-feature dependencies must be expressed through imported Nest modules.

**These rules are enforced by `npm run lint`, not by convention.** `eslint.config.mjs` encodes
every rule below; CI fails on a violation. If you change a rule here, change it there too.

## Layout

```text
src/
  main.ts                  process entry point
  bootstrap.ts             HTTP concerns shared by main.ts and the e2e tests
  app.module.ts            composition root
  config/                  the only place that reads process.env
  common/                  errors, HTTP middleware, shared constants — depends on nothing but config
  db/
    sql.util.ts            identifier quoting, shared by every SQL builder
    tenant/                per-request routing to a tenant database
    control-plane/         studio metadata persistence (users, projects, credentials)
    migrations/            append-only numbered migrations and their runner
  auth/ projects/ tables/ sql/ schemas/ policies/ mcp/ health/
```

## Dependency direction

```text
HTTP / MCP adapters -> application services -> ports <- PostgreSQL adapters
```

Allowed directions, enforced by `boundaries/element-types`:

| from      | may import                       |
| --------- | -------------------------------- |
| `app`     | anything                         |
| `feature` | feature, db, common, config      |
| `db`      | db, common, config               |
| `common`  | common, config                   |
| `config`  | config                           |

- Each controller injects a feature application interface (`*_APPLICATION`) rather than a
  concrete service class, so controller tests supply small mocks.
- Feature services depend on `ProjectDatabase`, never on `pg` or a concrete connection class.
  Importing `pg`, a `postgres-*` adapter, `connection-registry.service`, or `control-plane.pool`
  from outside `src/db` is a lint error.
- `db/tenant/database.ports.ts` holds tenant-facing contracts: `ProjectDatabase`,
  `ProjectConnectionReader`, `ProjectPoolInvalidator`, `PoolMetricsReader`.
- `db/control-plane/control-plane.ports.ts` holds narrow user, project, connection-test and
  tenant-admin contracts. Each is bound to exactly one adapter — `PostgresUserRepository`,
  `PostgresProjectRepository`, `PostgresConnectionTesterAdapter`, `PostgresDatabaseAdminAdapter`
  — so no single class accumulates unrelated persistence concerns.
- `projects/` implements `ProjectConnectionReader`; `health/` reads `PoolMetricsReader`.
- Shared SQL identifier handling lives in `db/sql.util.ts`; values must remain parameterized.
- Schema changes are append-only numbered migrations recorded in `_studio.migrations`.

## Errors

The application layer throws `ApplicationError` (`common/errors`) with a transport-neutral
code, never a Nest HTTP exception. Services are driven by more than one adapter — REST
controllers and the MCP tool layer today — and an HTTP status means nothing to a non-HTTP
caller. Translation happens at the edge:

- `ApplicationErrorFilter` maps a code to an HTTP status. It is the only such mapping.
- `mcp-tools.ts` renders the same error as an MCP tool error result.

Controllers may still throw Nest exceptions for pure transport faults (an unparseable query
string, say). A lint rule blocks HTTP exceptions in `*.service.ts`, `*.guard.ts`,
`*.repository.ts`, `*.adapter.ts` and `*.builder.ts`.

## Request-scoped tenant routing

`TenantDatabaseService` is a **singleton**. The per-request state — which project, which
user, which resolved pool — lives in an `AsyncLocalStorage` scope opened by
`TenantContextMiddleware`.

This deliberately replaces `Scope.REQUEST`. Request scoping in Nest is contagious: every
provider and controller transitively depending on a request-scoped provider is re-instantiated
per request, which previously covered the tables, sql, schemas, policies and MCP layers.

## Tenant connection scaling

`ConnectionRegistry` maintains a bounded LRU cache of tenant pools. Each pool has a small
connection limit, stale credentials replace the old pool, and completely idle pools expire on a
timer. Capacity is restricted by both pool count and a per-process connection budget; when it
is exhausted the registry sheds load with a `service_unavailable` error rather than exceeding
PostgreSQL's connection limit. Aggregate pool counts are returned by `GET /api/health` without
exposing tenant identifiers or credentials.

The limits are configured with `TENANT_POOL_MAX_POOLS`, `TENANT_POOL_MAX_CONNECTIONS`,
`TENANT_POOL_CONNECTION_BUDGET`, `TENANT_POOL_IDLE_TTL_MS`, and
`TENANT_POOL_SWEEP_INTERVAL_MS`. Production deployments should normally put PgBouncer in front
of PostgreSQL and calculate the per-instance budget from the database connection limit and the
maximum number of backend replicas.

## Trust boundary

The studio connects to databases its users name, from inside the server's own network.
That makes an unscreened host a request-forgery primitive, so `ConnectionTargetPolicy`
screens every user-supplied target before `assertConnectable` dials it:

- The configured `PGHOST` is refused by name, and any target resolving to that host and
  port is refused by address.
- Loopback, unspecified (`0.0.0.0`, `::`), link-local (including the `169.254.169.254`
  cloud metadata endpoint), multicast and reserved addresses are always refused.
- Private, unique-local and CGNAT addresses are refused unless
  `ALLOW_PRIVATE_DATABASE_HOSTS=true`, which a single-user self-hosted install can set.
- Hostnames are resolved first and **every** returned address must pass; matching on the
  hostname string alone is defeated by `0.0.0.0`, `[::1]`, `::ffff:10.0.0.1`, or a public
  DNS name pointing at a private address.

Managed provisioning targets the configured server deliberately and is not screened —
`ProjectsService.create` only applies the policy when `isManaged` is false.

Residual risk: the check resolves DNS, then `pg` resolves it again when connecting, so a
name whose answer changes in between (DNS rebinding) is not fully covered. Closing that
needs the connection pinned to the validated address.

### Control-plane privileges

`_studio` holds every user's password hash, encrypted database password and MCP token
hash. Do not run the backend as a superuser. Create a role that owns only `_studio` and
cannot reach tenant databases:

```sql
CREATE ROLE studio_app LOGIN PASSWORD '...';
REVOKE ALL ON DATABASE mydb FROM PUBLIC;
GRANT CONNECT ON DATABASE mydb TO studio_app;
GRANT ALL ON SCHEMA _studio TO studio_app;
GRANT ALL ON ALL TABLES IN SCHEMA _studio TO studio_app;
```

Managed provisioning additionally needs `CREATEDB` and `CREATEROLE`; grant those to the
same role rather than falling back to `postgres`. New managed databases have `CONNECT`
revoked from `PUBLIC` at creation so one tenant role cannot open another's database.

## Production boundaries

- HTTP requests have bounded bodies, security headers, request IDs, structured completion logs,
  and per-instance fixed-window rate limits. Enforce a shared limit at the ingress for a replica set.
- Tenant connections enforce PostgreSQL `statement_timeout` and
  `idle_in_transaction_session_timeout`; raw SQL responses also have row and byte caps.
- `/api/health/live` checks the process, `/api/health/ready` checks the control database and returns
  HTTP 503 when unavailable, and `/api/health/metrics` exposes low-cardinality Prometheus gauges.
- Large table scans should use the single-primary-key cursor API with `includeTotal=false`.
- Migrations take a transaction-scoped PostgreSQL advisory lock, making replica startup safe.

## Tests

`npm test` compiles `tsconfig.test.json` and runs `node --test` over the output, so tests are
type-checked against the same strict settings as `src`.

- Unit specs are colocated as `src/**/*.spec.ts` and excluded from the production build.
- `test/app.e2e.spec.ts` boots the real `AppModule` over HTTP with only the boot-time migration
  and pool metrics stubbed, so routing, validation, guards, error translation and hardening
  headers are covered by the code that actually ships.
- `npm run test:coverage` adds Node's coverage reporter.

Pure builders and rules (`row-query.builder.ts`, `alter-table.builder.ts`, `sql.util.ts`, cursor
encoding, the error filter, credential encryption) are the priority for unit tests — they are where a mistake is
silent and security-relevant.

## Adding a connector

Implement `ProjectDatabase` — `query`, `quoteIdent` and `transaction` — and bind it to the
`PROJECT_DATABASE` token in a connector module. `transaction` exists because a schema change can
need more than one statement (renaming and retyping a column, for instance) and must not half-apply.
Feature services remain unchanged. A connector that cannot implement PostgreSQL-specific schema
operations should expose separate capability modules instead of emulating unsupported behavior.

## Rules

1. Controllers translate transport input only; business and persistence logic belongs elsewhere.
2. Do not read `process.env` outside `config/`.
3. Do not inject concrete infrastructure services into feature services when a port exists.
4. Application code raises `ApplicationError`; only adapters speak HTTP.
5. Do not alter control-plane tables in service startup hooks; add a migration.
6. Keep migrations immutable after release.
7. Add unit tests for pure builders/rules and adapter tests for SQL implementations.

### Known deviations

- `@typescript-eslint/consistent-type-imports` is deliberately disabled: it is unsafe with
  `emitDecoratorMetadata`, which Nest DI depends on.
- `policies/` imports `TableMetadataService` from `tables/` directly. Both features operate on
  the same tables and the dependency is one-way; promote it to a shared port if a third feature
  needs it.
- The PostgreSQL adapters have no integration tests yet (rule 7's second half); they need a live
  PostgreSQL in CI. `docker-compose.yml` already provides a suitable instance locally.
