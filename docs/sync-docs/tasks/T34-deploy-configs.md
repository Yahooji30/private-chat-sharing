# T34 — Deploy configs (Hostinger VPS)

Depends: T33
Read: 04-DEPLOY (all), 02-ARCHITECTURE A0, A6 (Redis config), A11

Build in `deploy/`:
- `setup.sh` (idempotent, Ubuntu 24.04) per D3, including PostgreSQL 17+ (PGDG) with tuning file `postgres/sync.conf` and role/db creation, Redis config file `redis/redis.conf` (no persistence, localhost, password, maxmemory from RAM tier), prompts for domain, app user, email (certbot), generated secrets written to `.env` (chmod 600).
- `release.sh` per D4 (pre-release `pg_dump`, build into `releases/<ts>` + symlink `current`, `db:migrate`, `pm2 reload`, health check on `/api/health` and a websocket handshake on :4001, automatic rollback to previous release on failure).
- `ecosystem.config.cjs` per D5 (`sync-api` cluster, `sync-rt` cluster, `sync-web`), instance counts chosen by RAM tier variable.
- `nginx/sync.conf` + `nginx/admin.conf` per D6 (templated `__DOMAIN__`, three upstreams), `nginx/snippets/security-headers.conf`.
- `coturn/turnserver.conf` per D7 (templated).
- `backup.sh` + cron line per D8 (`pg_dump -Fc`, keep 14); `restore.sh` (`pg_restore --clean`).
- pm2-logrotate settings.
- `scripts/redis-ttl-audit.sh`: reports keys without TTL (allowed: `sp:dirty`, `chat:grace`).

Acceptance: fresh Ubuntu 24.04 VM (multipass/docker systemd) → `setup.sh` + `release.sh` → site on HTTPS, websockets work through nginx to :4001, chat room works across 2 rt instances, admin reachable, backup file created, `redis-cli CONFIG GET save` is empty, PG and Redis not reachable from outside.

Do NOT: Docker in production (extra RAM on small VPS); keep native PM2 + apt services.
