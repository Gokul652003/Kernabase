# Deploying to a VPS

Everything runs as three containers: PostgreSQL, the API, and an edge (Caddy) that
terminates TLS, serves the frontend and proxies `/api`. Only the edge is exposed.

```
internet ──▶ edge :80/:443  ──┬──▶ /api/*  ──▶ backend :3001 ──▶ db :5432
             (TLS, static)    └──▶ /*       ──▶ built SPA
```

## Sizing

Roughly 1.2 GB at idle. **4 GB is comfortable**; 2 GB works with the lower memory
limits noted below. Avoid 1 GB — PostgreSQL, Node and a Docker build together will OOM.

Every managed user database lives on this one PostgreSQL instance and holds a pool, so
keep `TENANT_POOL_CONNECTION_BUDGET` below `POSTGRES_MAX_CONNECTIONS`.

## 1. Prepare the server

```bash
ssh root@YOUR_VPS_IP
apt update && apt install -y docker.io docker-compose-plugin git
```

Point your domain's **A record** at the VPS IP before continuing — Caddy cannot obtain a
certificate until DNS resolves, and repeated failures hit Let's Encrypt's rate limits.

Open only what is needed:

```bash
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
```

Do **not** open 5432 or 3001. The overlay does not publish them; they are reachable only
inside the Docker network.

## 2. Configure

```bash
git clone YOUR_REPO_URL kernabase && cd kernabase
cp .env.example .env
```

Fill in `.env`:

```bash
POSTGRES_PASSWORD=$(openssl rand -hex 24)
STUDIO_JWT_SECRET=$(openssl rand -base64 48)
STUDIO_SECRET=$(openssl rand -base64 48)
SITE_ADDRESS=studio.example.com          # bare domain, no scheme
PUBLIC_ORIGIN=https://studio.example.com # with scheme; becomes CORS_ORIGINS
```

On a 2 GB VPS also set:

```bash
DB_MEMORY_LIMIT=768m
BACKEND_MEMORY_LIMIT=384m
EDGE_MEMORY_LIMIT=96m
POSTGRES_SHARED_BUFFERS=128MB
TENANT_POOL_CONNECTION_BUDGET=40
```

> **`STUDIO_SECRET` cannot be rotated casually.** It derives the key that encrypts every
> stored database password. Changing it makes all of them undecryptable, and there is no
> re-encryption command yet. Generate it once and back it up somewhere you will not lose.

Leave `ALLOW_PRIVATE_DATABASE_HOSTS=false`. On a shared server it is what stops one user
pointing the studio at the control plane or scanning the internal network.

## 3. Start

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

All three should report `healthy`. First start takes a few minutes: it builds the
frontend and the API, then obtains a certificate.

```bash
curl https://studio.example.com/api/health/ready
```

If TLS fails, `docker compose logs edge` names the reason — almost always DNS not yet
pointing here, or 80/443 blocked.

## 4. Reduce the control-plane privileges

The stack starts as the `postgres` superuser, which is more than the API needs. The
`_studio` schema holds every user's password hash, encrypted database password and MCP
token hash, so give the API its own role:

```sql
CREATE ROLE studio_app LOGIN PASSWORD 'a-new-strong-password' CREATEDB CREATEROLE;
REVOKE ALL ON DATABASE mydb FROM PUBLIC;
GRANT CONNECT ON DATABASE mydb TO studio_app;
GRANT ALL ON SCHEMA _studio TO studio_app;
GRANT ALL ON ALL TABLES IN SCHEMA _studio TO studio_app;
```

`CREATEDB` and `CREATEROLE` are required for managed project provisioning. Then set
`POSTGRES_USER`/`POSTGRES_PASSWORD` to that role and restart.

## 5. Back up

Losing the database volume loses every user's data. Daily dump, kept off-box:

```bash
cat >/etc/cron.daily/kernabase-backup <<'SH'
#!/bin/sh
cd /root/kernabase || exit 1
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db \
  pg_dumpall -U "${POSTGRES_USER:-postgres}" | gzip > "/root/backups/$(date +%F).sql.gz"
find /root/backups -name '*.sql.gz' -mtime +14 -delete
SH
chmod +x /etc/cron.daily/kernabase-backup && mkdir -p /root/backups
```

`pg_dumpall` is used rather than `pg_dump` so tenant roles are captured too — a dump
without them restores databases whose owners do not exist. Copy the files off the VPS;
a backup on the same disk is not a backup. Test a restore before you rely on it.

## 6. Updating

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Migrations run on boot under a PostgreSQL advisory lock, so this is safe to repeat.

## Operating notes

```bash
# logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend

# psql, over an SSH tunnel — the port is not published publicly
ssh -L 55432:localhost:55432 root@YOUR_VPS_IP
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec db psql -U postgres -d mydb
```

## Known limitations

- **No TLS to tenant databases.** The backend connects to user-supplied databases without
  SSL, so hosted providers that require it (Supabase, Neon, RDS with `rds.force_ssl`)
  cannot be added. Managed projects are unaffected — they are local to this server.
- **Sessions cannot be revoked.** Tokens are stateless and valid for 30 days; logging out
  only clears the browser copy. Shorten `STUDIO_JWT_EXPIRES_IN` if that matters.
- **Rate limits are per instance.** One replica is assumed. Behind a load balancer,
  enforce limits at the ingress as well.
- **Single host.** No replication or failover; the backup above is the recovery plan.
